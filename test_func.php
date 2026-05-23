<?php
function writeKardexFailsafeLog(int $usuario_id, string $tipo, int $producto_id, int $lote_id, int $origen_id, int $destino_id, int $cantidad): void {
    $dir = __DIR__ . '/backups';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    // Asegurar protección del directorio backups mediante .htaccess
    $htaccessFile = $dir . '/.htaccess';
    if (!file_exists($htaccessFile)) {
        file_put_contents($htaccessFile, "Deny from all\n");
    }

    $logEntry = json_encode([
        'timestamp'   => date('Y-m-d H:i:s'),
        'usuario_id'  => $usuario_id,
        'tipo'        => $tipo,
        'producto_id' => $producto_id,
        'lote_id'     => $lote_id,
        'origen_id'   => $origen_id,
        'destino_id'  => $destino_id,
        'cantidad'    => $cantidad
    ], JSON_UNESCAPED_UNICODE) . "\n";

    $res = file_put_contents($dir . '/kardex.jsonl', $logEntry, FILE_APPEND | LOCK_EX);
    if ($res === false) { echo "Failed to write.\n"; } else { echo "Success bytes: $res\n"; }
}

writeKardexFailsafeLog(1, 'Test', 2, 3, 4, 5, 10);
