<?php
require_once __DIR__ . '/inventario.php';

try {
    writeKardexFailsafeLog(1, 'Test', 2, 3, 4, 5, 10);
    echo "Success\n";
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
