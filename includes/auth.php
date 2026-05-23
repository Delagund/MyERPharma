<?php
// ============================================================
//  MyErPharma - Módulo de Autenticación
// ============================================================

require_once __DIR__ . '/db.php';

// Polyfill para getallheaders() si el hosting corre bajo FastCGI/PHP-FPM sin Apache
if (!function_exists('getallheaders')) {
    function getallheaders(): array {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (str_starts_with($name, 'HTTP_')) {
                $key = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                $headers[$key] = $value;
            }
        }
        return $headers;
    }
}

// Iniciar sesión de forma segura (evita doble inicio en hosting compartido)
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_strict_mode', 1);
    global $isLocal;
    if (isset($isLocal) && !$isLocal) {
        ini_set('session.cookie_secure', 1);
    }
    session_start();
}

function isLoggedIn(): bool {
    return isset($_SESSION['user_id']);
}

function generateCsrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function getCsrfToken(): string {
    return generateCsrfToken();
}

function validateCsrfToken(?string $token): bool {
    if (empty($_SESSION['csrf_token']) || empty($token)) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

function validateCsrfHeader(): void {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array(strtoupper($method), ['POST', 'PUT', 'DELETE', 'PATCH'])) {
        return;
    }

    $headers = getallheaders();
    $headers = array_change_key_case($headers, CASE_LOWER);
    $token = $headers['x-csrf-token'] ?? null;

    if (!$token) {
        $input = json_decode(file_get_contents('php://input'), true);
        $token = $input['csrf_token'] ?? $_POST['csrf_token'] ?? null;
    }

    if (!validateCsrfToken($token)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'Error de validación de seguridad (CSRF). Intente recargar la página.']);
        exit;
    }
}

function requireLogin(): void {
    if (!isLoggedIn()) {
        if (str_contains($_SERVER['REQUEST_URI'] ?? '', '/api/')) {
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false, 'error' => 'Sesión expirada o no iniciada.']);
            exit;
        }
        header('Location: login.php');
        exit;
    }
    validateCsrfHeader();
}

function login(string $username, string $password): bool {
    if (isset($_SESSION['login_lockout_time']) && time() < $_SESSION['login_lockout_time']) {
        return false;
    }

    $db = getDB();
    $stmt = $db->prepare("SELECT id, password_hash, role FROM usuarios WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['user_id']   = $user['id'];
        $_SESSION['username']  = $username;
        $_SESSION['role']      = $user['role'];
        
        // Limpiar intentos al autenticar correctamente
        unset($_SESSION['login_attempts']);
        unset($_SESSION['login_lockout_time']);
        return true;
    }

    // Registrar intento fallido
    $_SESSION['login_attempts'] = ($_SESSION['login_attempts'] ?? 0) + 1;
    if ($_SESSION['login_attempts'] >= 5) {
        $_SESSION['login_lockout_time'] = time() + 30; // bloqueo de 30 segundos
    }
    return false;
}

function logout(): void {
    session_unset();
    session_destroy();
    header('Location: login.php');
    exit;
}

function currentUser(): array {
    return [
        'id'       => $_SESSION['user_id']  ?? null,
        'username' => $_SESSION['username'] ?? '',
        'role'     => $_SESSION['role']     ?? 'user',
    ];
}

