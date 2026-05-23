<?php
// ============================================================
//  api/backup.php — Respaldos de BD y Kardex (Failsafe)
//  Solo para administradores.
// ============================================================

require_once __DIR__ . '/../includes/auth.php';
requireLogin();

// Restringir a rol admin
if (currentUser()['role'] !== 'admin') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Acceso denegado. Se requieren privilegios de administrador.']);
    exit;
}

$db = getDB();

// Directorio de backups
$backupsDir = __DIR__ . '/../backups';
if (!is_dir($backupsDir)) {
    mkdir($backupsDir, 0755, true);
}
// Asegurar .htaccess
$htaccessFile = $backupsDir . '/.htaccess';
if (!file_exists($htaccessFile)) {
    file_put_contents($htaccessFile, "Deny from all\n");
}

// 1) Generar volcado SQL
$sqlFilename = 'backup_temp_' . uniqid() . '.sql';
$sqlPath = $backupsDir . '/' . $sqlFilename;
$sqlFile = fopen($sqlPath, 'w');
if (!$sqlFile) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'No se pudo crear el archivo temporal de respaldo.']);
    exit;
}

// Escribir cabecera
fwrite($sqlFile, "-- MyERPharma Backup\n");
fwrite($sqlFile, "-- Generado: " . date('Y-m-d H:i:s') . "\n");
fwrite($sqlFile, "SET FOREIGN_KEY_CHECKS=0;\n\n");

$tables = ['usuarios', 'productos', 'codigos_barra', 'lotes', 'ubicaciones', 'inventario', 'tipo_movimiento', 'historial_movimientos'];

foreach ($tables as $table) {
    // Estructura
    try {
        $stmt = $db->query("SHOW CREATE TABLE `$table`");
        $row = $stmt->fetch(PDO::FETCH_NUM);
        if ($row) {
            fwrite($sqlFile, "DROP TABLE IF EXISTS `$table`;\n");
            fwrite($sqlFile, $row[1] . ";\n\n");
        }
    } catch (PDOException $e) {
        continue;
    }

    // Datos en chunks para optimizar memoria y tiempo de ejecución
    $offset = 0;
    $limit = 500;
    while (true) {
        $stmt = $db->prepare("SELECT * FROM `$table` LIMIT ? OFFSET ?");
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->bindValue(2, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($rows)) {
            break;
        }

        $insertSql = "INSERT INTO `$table` (" . implode(', ', array_map(fn($k) => "`$k`", array_keys($rows[0]))) . ") VALUES \n";
        $valuesArr = [];
        foreach ($rows as $row) {
            $vals = array_map(function($val) use ($db) {
                if ($val === null) return 'NULL';
                return $db->quote($val);
            }, array_values($row));
            $valuesArr[] = "(" . implode(', ', $vals) . ")";
        }
        $insertSql .= implode(",\n", $valuesArr) . ";\n\n";
        fwrite($sqlFile, $insertSql);

        $offset += $limit;
    }
}

fwrite($sqlFile, "SET FOREIGN_KEY_CHECKS=1;\n");
fclose($sqlFile);

// 2) Comprimir en ZIP
$zipFilename = 'backup_temp_' . uniqid() . '.zip';
$zipPath = $backupsDir . '/' . $zipFilename;
$zip = new ZipArchive();
if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    unlink($sqlPath);
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'No se pudo crear el archivo ZIP comprimido.']);
    exit;
}

$zip->addFile($sqlPath, 'backup.sql');

$kardexPath = $backupsDir . '/kardex.jsonl';
if (file_exists($kardexPath)) {
    $zip->addFile($kardexPath, 'kardex.jsonl');
}

$zip->close();
unlink($sqlPath);

// 3) Cifrar ZIP con AES-256-CBC
$zipData = file_get_contents($zipPath);
if ($zipData === false) {
    unlink($zipPath);
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'No se pudo leer el archivo ZIP temporal para cifrarlo.']);
    exit;
}

$method = 'AES-256-CBC';
$passphrase = 'MyERPharmaBackupKey2026!'; // Contraseña simétrica de la aplicación

$ivLength = openssl_cipher_iv_length($method);
$iv = openssl_random_pseudo_bytes($ivLength);

$encryptedData = openssl_encrypt($zipData, $method, $passphrase, OPENSSL_RAW_DATA, $iv);
unlink($zipPath);

if ($encryptedData === false) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Error al cifrar los datos de respaldo.']);
    exit;
}

$finalPayload = $iv . $encryptedData;

// Forzar descarga con extensión .zip.enc
header('Content-Description: File Transfer');
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="backup_' . date('Ymd_His') . '.zip.enc"');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . strlen($finalPayload));

echo $finalPayload;
exit;
