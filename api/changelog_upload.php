<?php
// ============================================================
//  api/changelog_upload.php — Subida y Sobreescritura de Changelog
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

if (!isset($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No se subió ningún archivo o hubo un error en la subida.']);
    exit;
}

$fileTmp  = $_FILES['archivo']['tmp_name'];
$fileName = $_FILES['archivo']['name'];

// Validar extensión .json
$ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
if ($ext !== 'json') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'El archivo debe ser un archivo de extensión .json']);
    exit;
}

// Leer y validar que sea JSON válido
$content = file_get_contents($fileTmp);
if ($content === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'No se pudo leer el archivo subido.']);
    exit;
}

$data = json_decode($content, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Formato JSON inválido: ' . json_last_error_msg()]);
    exit;
}

// Validar estructura básica del JSON (debe ser un array de versiones)
if (!is_array($data)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'El archivo JSON debe contener un arreglo de versiones en la raíz.']);
    exit;
}

foreach ($data as $idx => $versionData) {
    if (!isset($versionData['version']) || !isset($versionData['fecha']) || !isset($versionData['titulo']) || !isset($versionData['descripcion'])) {
        http_response_code(422);
        echo json_encode([
            'ok' => false, 
            'error' => "Estructura inválida en el índice {$idx}. Cada versión debe tener 'version', 'fecha', 'titulo' y 'descripcion'."
        ]);
        exit;
    }
    if (isset($versionData['secciones']) && !is_array($versionData['secciones'])) {
        http_response_code(422);
        echo json_encode([
            'ok' => false, 
            'error' => "Las secciones de la versión {$versionData['version']} deben ser un arreglo."
        ]);
        exit;
    }
}

// Intentar guardar el archivo de forma segura
$targetPath = __DIR__ . '/../assets/release_note.json';
$dir = dirname($targetPath);

// Asegurar que el directorio de destino exista
if (!is_dir($dir)) {
    if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'No se pudo crear el directorio de destino.']);
        exit;
    }
}

if (!is_writable($dir) || (file_exists($targetPath) && !is_writable($targetPath))) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'El directorio assets/ o el archivo de notas de versión no es escribible.']);
    exit;
}

// Sobreescribir el archivo estático
if (@file_put_contents($targetPath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Error al escribir el archivo release_note.json en el servidor.']);
    exit;
}

echo json_encode([
    'ok' => true,
    'mensaje' => 'Notas de versión actualizadas correctamente en el servidor.'
]);
