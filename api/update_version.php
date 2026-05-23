<?php
// ============================================================
//  api/update_version.php — Actualización del número de versión del sistema
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

header('Content-Type: application/json; charset=utf-8');

// Validar que el usuario sea administrador
if (currentUser()['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Acceso denegado. Se requieren permisos de administrador.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método no permitido.']);
    exit;
}

// Obtener los datos del cuerpo de la petición (JSON)
$input = json_decode(file_get_contents('php://input'), true);
$newVersion = isset($input['version']) ? trim($input['version']) : '';

if (empty($newVersion)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'El número de versión es requerido.']);
    exit;
}

// Validar formato de versión (ej: 1.0.0 o 10.2.1)
if (!preg_match('/^\d+\.\d+\.\d+$/', $newVersion)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'El formato de versión debe ser X.Y.Z (ej. 1.0.0 o 10.2.1).']);
    exit;
}

$versionFile = __DIR__ . '/../includes/version.php';

// Generar contenido PHP seguro para retornar el string de versión
$codeContent = "<?php\n// includes/version.php — Almacena la versión actual del sistema\nreturn '" . addslashes($newVersion) . "';\n";

if (file_put_contents($versionFile, $codeContent) !== false) {
    echo json_encode([
        'ok' => true,
        'mensaje' => 'La versión del sistema ha sido actualizada exitosamente.',
        'version' => $newVersion
    ]);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'No se pudo escribir en el archivo de versión. Verifique los permisos del servidor.']);
}
