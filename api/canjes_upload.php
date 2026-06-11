<?php
// ============================================================
//  api/canjes_upload.php — Subida de Matriz de Canjes
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método no permitido.']);
    exit;
}

if (!isset($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No se subió ningún archivo o hubo un error en la subida.']);
    exit;
}

$fileTmp = $_FILES['archivo']['tmp_name'];
$fileName = $_FILES['archivo']['name'];

// Validar que sea CSV por extensión o mime (mime a veces es text/plain, mejor confiar en extensión por ahora)
$ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
if ($ext !== 'csv') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'El archivo debe ser un .csv']);
    exit;
}

$db = getDB();

try {
    // 1. Crear tabla temporal
    $db->exec("CREATE TABLE reglas_devolucion_temp LIKE reglas_devolucion");

    // 2. Abrir archivo y procesar
    $handle = fopen($fileTmp, 'r');
    if ($handle === false) {
        throw new Exception("No se pudo abrir el archivo subido.");
    }
    $firstLine = fgets($handle);
    $delimiter = ',';
    if (substr_count($firstLine, ';') > substr_count($firstLine, ',')) {
        $delimiter = ';';
    } elseif (substr_count($firstLine, "\t") > substr_count($firstLine, ',')) {
        $delimiter = "\t";
    }
    rewind($handle);

    // Leer cabeceras (pasando todos los parámetros para evitar Deprecated warning en PHP 8.4)
    $headers = fgetcsv($handle, 0, $delimiter, '"', '\\');
    if (!$headers) {
        throw new Exception("El archivo CSV está vacío o es inválido.");
    }

    // Limpiar BOM si existe en la primera cabecera
    if (str_starts_with($headers[0], "\xEF\xBB\xBF")) {
        $headers[0] = substr($headers[0], 3);
    }
    $headers = array_map('trim', $headers);

    // Mapeo dinámico de índices
    $idxCodigo = -1;
    $idxVencimiento = -1;
    $idxDevolver = -1;
    $idxLaboratorio = -1;

    foreach ($headers as $i => $h) {
        // Forzar a UTF-8 por si el Excel se guardó en ISO-8859-1 (muy común en español)
        $h_utf8 = mb_check_encoding($h, 'UTF-8') ? $h : mb_convert_encoding($h, 'UTF-8', 'ISO-8859-1');
        
        $hl = mb_strtolower($h_utf8, 'UTF-8');
        // Quitar tildes para simplificar la búsqueda
        $hl = str_replace(['á','é','í','ó','ú'], ['a','e','i','o','u'], $hl);
        
        // Remover cualquier caracter raro (como em-dash generado por MacRoman)
        $hl = preg_replace('/[^a-z0-9 ]/', '', $hl);
        
        // Búsqueda estricta para evitar que choque con "Código de barras" o "Código MCO"
        if (str_contains($hl, 'codigo producto') || str_contains($hl, 'cdigo producto')) $idxCodigo = $i;
        if (str_contains($hl, 'mes de vencimiento') || str_contains($hl, 'vencimiento a devolver')) $idxVencimiento = $i;
        if ($hl === 'devolver' || str_contains($hl, 'canje')) $idxDevolver = $i;
        if ($hl === 'laboratorio' || $hl === 'nombre laboratorio') $idxLaboratorio = $i;
    }

    if ($idxCodigo === -1 || $idxDevolver === -1) {
        $headers_debug = print_r($headers, true);
        throw new Exception("No se encontraron las columnas requeridas (Código y Devolver). Cabeceras detectadas: " . $headers_debug);
    }

    $stmt = $db->prepare("
        INSERT INTO reglas_devolucion_temp 
        (cod_socofar, laboratorio, tiene_canje, mes_vencimiento_devolver) 
        VALUES (?, ?, ?, ?)
    ");

    $countInserted = 0;
    $countFailedDates = 0;

    while (($row = fgetcsv($handle, 0, $delimiter, '"', '\\')) !== false) {
        if (empty(array_filter($row))) continue; // Saltar filas vacías

        // Para evitar errores en la base de datos (utf8mb4), convertimos los strings a UTF-8
        // si el archivo viene codificado en ISO-8859-1 (muy común en archivos exportados desde Excel).
        $row = array_map(function($val) {
            if ($val === null) return null;
            return mb_check_encoding($val, 'UTF-8') ? $val : mb_convert_encoding($val, 'UTF-8', 'ISO-8859-1');
        }, $row);

        $codigo = isset($row[$idxCodigo]) ? trim($row[$idxCodigo]) : '';
        if ($codigo === '') continue;

        $laboratorio = $idxLaboratorio !== -1 && isset($row[$idxLaboratorio]) ? trim($row[$idxLaboratorio]) : null;
        
        $valDevolver = isset($row[$idxDevolver]) ? mb_strtolower(trim($row[$idxDevolver]), 'UTF-8') : '';
        // Un producto tiene canje si el valor no está vacío, no es 'no' y no contiene 'sin canje' para evitar falsos positivos
        $tiene_canje = (!empty($valDevolver) && $valDevolver !== 'no' && !str_contains($valDevolver, 'sin canje')) ? 1 : 0;

        $fechaStr = $idxVencimiento !== -1 && isset($row[$idxVencimiento]) ? trim($row[$idxVencimiento]) : '';
        $fechaDb = null;
        if (!empty($fechaStr) && strtolower($fechaStr) !== 'sin canje') {
            $fechaStr = str_replace('/', '-', trim($fechaStr));
            $fechaStr = mb_strtolower($fechaStr, 'UTF-8');
            
            $d = DateTime::createFromFormat('d-m-Y', $fechaStr);
            if (!$d) $d = DateTime::createFromFormat('Y-m-d', $fechaStr);
            
            if ($d) {
                $fechaDb = $d->format('Y-m-d');
            } else {
                // Intentar formato "abr-26" o "abr-2026" (Mes español - Año)
                // Se agregan variaciones como 'sept' y 'set' para evitar fallos cuando el CSV viene con 4 caracteres para septiembre (ej. sept-26).
                $mesesEs = [
                    'ene' => '01', 'feb' => '02', 'mar' => '03', 'abr' => '04',
                    'may' => '05', 'jun' => '06', 'jul' => '07', 'ago' => '08',
                    'sep' => '09', 'sept' => '09', 'set' => '09', 'oct' => '10',
                    'nov' => '11', 'dic' => '12'
                ];
                // Se cambia {3} a {3,4} para soportar abreviaciones de mes de 4 caracteres
                if (preg_match('/^([a-z]{3,4})-(\d{2,4})$/', $fechaStr, $matches)) {
                    $mesTxt = $matches[1];
                    $anioTxt = $matches[2];
                    if (strlen($anioTxt) === 2) {
                        $anioTxt = "20" . $anioTxt; // asume 20xx
                    }
                    if (isset($mesesEs[$mesTxt])) {
                        $mesNum = $mesesEs[$mesTxt];
                        // Establecemos el primer día del mes, según la convención del sistema
                        $fechaDb = "$anioTxt-$mesNum-01";
                    } else {
                        $countFailedDates++;
                    }
                } else {
                    $countFailedDates++;
                }
            }
        } $stmt->execute([$codigo, $laboratorio, $tiene_canje, $fechaDb]);
        $countInserted++;
    }

    fclose($handle);

    // 3. Swap atómico de tablas
    $db->exec("RENAME TABLE reglas_devolucion TO reglas_devolucion_old, reglas_devolucion_temp TO reglas_devolucion");
    $db->exec("DROP TABLE reglas_devolucion_old");

    ob_clean();
    echo json_encode([
        'ok' => true,
        'insertados' => $countInserted,
        'fallos_fecha' => $countFailedDates,
        'mensaje' => "Matriz actualizada correctamente. $countInserted registros procesados."
    ]);

} catch (Exception $e) {
    // Intentar limpiar tabla temporal si falló
    try { $db->exec("DROP TABLE IF EXISTS reglas_devolucion_temp"); } catch (Exception $ex) {}
    
    http_response_code(500);
    ob_clean();
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
