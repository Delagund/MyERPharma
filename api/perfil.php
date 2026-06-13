<?php
// ============================================================
//  api/perfil.php — Gestión de Perfil de Usuario
//  Acciones: change_password
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

// 🚀 CARGA GLOBAL DE CAPAS: Disponibles para todo el ciclo de vida de la API
require_once __DIR__ . '/../includes/PerfilRepository.php';
require_once __DIR__ . '/../includes/PerfilService.php';
require_once __DIR__ . '/../includes/RequestValidator.php';

$action = $_GET['action'] ?? ($argv[1] ?? '');

header('Content-Type: application/json; charset=utf-8');
$db = getDB();

if ($action === 'change_password') {
    actionChangePassword($db);
} else {
    jsonError('Acción no reconocida.', 400);
}

/**
 * Cambia la contraseña del usuario actualmente logueado.
 * 
 * Se encarga de las validaciones a nivel de formulario/UX (campos vacíos y confirmación)
 * y delega la validación de negocio y persistencia criptográfica en PerfilService.
 */
function actionChangePassword(PDO $db): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonError('Método no permitido.', 405);
        return;
    }

    $body = jsonBody();

    // Validación agnóstica de inputs (controlador)
    $error = RequestValidator::validate($body, [
        'password_actual' => ['required' => true, 'label' => 'contraseña actual'],
        'nueva_password'  => ['required' => true, 'label' => 'nueva contraseña'],
        'confirmacion'    => ['required' => true, 'label' => 'confirmación', 'matches' => 'nueva_password'],
    ]);

    if ($error !== null) {
        jsonError($error);
        return;
    }

    $passActual = trim($body['password_actual']);
    $passNueva  = trim($body['nueva_password']);

    // Inicializar componentes del Monolito Modular
    $repository = new PerfilRepository($db);
    $service    = new PerfilService($repository);

    try {
        $userId = currentUser()['id'];
        $service->cambiarContrasena($userId, $passActual, $passNueva);

        echo json_encode(['ok' => true, 'message' => 'Contraseña actualizada correctamente.']);
    } catch (InvalidArgumentException | DomainException $e) {
        jsonError($e->getMessage(), 422);
    } catch (Exception $e) {
        jsonError('Error al actualizar la contraseña: ' . $e->getMessage(), 500);
    }
}

// ---- Helpers ----
function jsonBody(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw) && getenv('MOCK_POST_BODY')) {
        $raw = getenv('MOCK_POST_BODY');
    }
    return json_decode($raw, true) ?? [];
}

function jsonError(string $msg, int $code = 422): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}
