<?php
// ============================================================
//  api/perfil.php — Gestión de Perfil de Usuario
//  Acciones: change_password
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

header('Content-Type: application/json; charset=utf-8');

$db = getDB();
$action = $_GET['action'] ?? '';

if ($action === 'change_password') {
    actionChangePassword($db);
} else {
    jsonError('Acción no reconocida.', 400);
}

/**
 * Cambia la contraseña del usuario actualmente logueado.
 */
function actionChangePassword(PDO $db): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonError('Método no permitido.', 405);
        return;
    }

    $body = jsonBody();
    $passActual = $body['password_actual'] ?? '';
    $passNueva   = $body['nueva_password']  ?? '';
    $confirm    = $body['confirmacion']   ?? '';
    $userId     = $_SESSION['user_id'];

    // 1. Validaciones básicas de entrada
    if (!$passActual || !$passNueva || !$confirm) {
        jsonError('Todos los campos son obligatorios.');
        return;
    }

    if (strlen($passNueva) < 8) {
        jsonError('La nueva contraseña debe tener al menos 8 caracteres.');
        return;
    }

    if ($passNueva !== $confirm) {
        jsonError('La nueva contraseña y la confirmación no coinciden.');
        return;
    }

    // 2. Verificar contraseña actual en DB
    $stmt = $db->prepare("SELECT password_hash FROM usuarios WHERE id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($passActual, $user['password_hash'])) {
        jsonError('La contraseña actual es incorrecta.');
        return;
    }

    // 3. Validar que la nueva no sea igual a la actual
    if (password_verify($passNueva, $user['password_hash'])) {
        jsonError('La nueva contraseña no puede ser igual a la anterior.');
        return;
    }

    // 4. Actualizar hash
    try {
        $nuevoHash = password_hash($passNueva, PASSWORD_BCRYPT, ['cost' => 12]);
        $update = $db->prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?");
        $update->execute([$nuevoHash, $userId]);

        echo json_encode(['ok' => true, 'message' => 'Contraseña actualizada correctamente.']);
    } catch (PDOException $e) {
        jsonError('Error al actualizar la contraseña: ' . $e->getMessage());
    }
}

// ---- Helpers ----
function jsonBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function jsonError(string $msg, int $code = 422): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}
