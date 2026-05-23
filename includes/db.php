<?php
// ============================================================
//  MyErPharma - Configuración de Base de Datos
// ============================================================

$isLocal = (
    (isset($_SERVER['SERVER_NAME']) && ($_SERVER['SERVER_NAME'] === 'localhost' || $_SERVER['SERVER_ADDR'] === '127.0.0.1')) ||
    (php_sapi_name() === 'cli')
);
if ($isLocal) {
    define('DB_HOST',    'localhost');
    define('DB_NAME',    'myerpharma'); //nombre base de datos local
    define('DB_USER',    'root');
    define('DB_PASS',    '');
} else {
    define('DB_HOST',    'sql312.infinityfree.com');
    define('DB_NAME',    'if0_41453235_myerpharma');
    define('DB_USER',    'if0_41453235');
    define('DB_PASS',    'mq9RifO5gWvZq');
}
define('DB_CHARSET', 'utf8mb4');

/**
 * Devuelve una conexión PDO singleton.
 * Intenta primero con DB_HOST; si falla, reintenta con "localhost".
 * Lanza una RuntimeException en caso de error para que el caller decida cómo manejarlo.
 */
function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_TIMEOUT            => 5,
    ];

    $hosts = [DB_HOST, '127.0.0.1', 'localhost'];
    $lastError = '';

    foreach ($hosts as $host) {
        try {
            $dsn = "mysql:host={$host};dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
            return $pdo;
        } catch (PDOException $e) {
            $lastError = $e->getMessage();
            $pdo = null;
        }
    }

    // Ambos hosts fallaron — detectar contexto para el tipo de respuesta
    http_response_code(500);
    $isApiRequest = str_contains($_SERVER['REQUEST_URI'] ?? '', '/api/');

    if ($isApiRequest) {
        header('Content-Type: application/json; charset=utf-8');
        die(json_encode(['error' => 'Error de conexión a la base de datos.']));
    } else {
        die('
            <div style="font-family:sans-serif;max-width:500px;margin:4rem auto;padding:2rem;
                        background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;color:#991B1B">
                <h2 style="margin:0 0 .5rem">⚠️ Error de Conexión</h2>
                <p style="margin:0 0 .75rem;font-size:.9rem">No se pudo conectar a la base de datos MySQL.</p>
                <code style="display:block;background:#fff;padding:.5rem;border-radius:6px;
                             font-size:.75rem;word-break:break-all;color:#475569">'
                . htmlspecialchars($lastError) . '</code>
                <p style="margin:.75rem 0 0;font-size:.8rem;color:#B91C1C">
                    Verifica el host, usuario y contraseña en <strong>includes/db.php</strong>.
                </p>
            </div>
        ');
    }
}
