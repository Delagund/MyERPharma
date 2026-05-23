<?php
require_once __DIR__ . '/includes/auth.php';
$version = require_once __DIR__ . '/includes/version.php';
if (isLoggedIn()) {
    header('Location: index.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $csrfToken = $_POST['csrf_token'] ?? '';
    if (!validateCsrfToken($csrfToken)) {
        $error = 'Error de validación de seguridad (CSRF). Por favor, recarga e intenta de nuevo.';
    } else {
        // Verificar si está bloqueado
        if (isset($_SESSION['login_lockout_time']) && time() < $_SESSION['login_lockout_time']) {
            $secondsLeft = $_SESSION['login_lockout_time'] - time();
            $error = "Demasiados intentos fallidos. Intente de nuevo en {$secondsLeft} segundos.";
        } else {
            $username = trim($_POST['username'] ?? '');
            $password = $_POST['password'] ?? '';
            if (!login($username, $password)) {
                if (isset($_SESSION['login_lockout_time']) && time() < $_SESSION['login_lockout_time']) {
                    $error = 'Demasiados intentos fallidos. Su cuenta ha sido bloqueada temporalmente por 30 segundos.';
                } else {
                    $error = 'Usuario o contraseña incorrectos.';
                }
            } else {
                header('Location: index.php');
                exit;
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acceso — MyErPharma</title>
    <meta name="description" content="Sistema de control de inventario y caducidades MyErPharma. Inicia sesión para acceder.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="login-body">
    <div class="login-wrapper">
        <!-- Panel Izquierdo: Branding/Features -->
        <div class="login-brand">
            <div class="login-brand-inner">
                <div class="brand-logo">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="48" height="48" rx="12" fill="url(#grad1)"/>
                        <path d="M24 10v28M10 24h28" stroke="white" stroke-width="4" stroke-linecap="round"/>
                        <defs>
                            <linearGradient id="grad1" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                                <stop stop-color="#6366f1"/>
                                <stop offset="1" stop-color="#4f46e5"/>
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <div class="brand-title-group">
                    <h1 class="brand-name">MyErPharma</h1>
                    <span class="brand-version">v<?= htmlspecialchars($version) ?></span>
                </div>
                <p class="brand-tagline">Sistema de Gestión de Inventario<br>y Control de Caducidades</p>
                <div class="brand-features">
                    <div class="feature-item">
                        <span class="feature-icon">📦</span>
                        <span>Control de stock en tiempo real</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">📅</span>
                        <span>Alertas de vencimiento</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">📊</span>
                        <span>Reportes exportables</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Panel Derecho: Formulario -->
        <div class="login-form-panel">
            <div class="login-form-card">
                <div class="login-form-header">
                    <h2>Bienvenido</h2>
                    <p>Ingresa tus credenciales para continuar</p>
                </div>

                <?php if ($error): ?>
                <div class="alert alert-error" id="login-error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    <?= htmlspecialchars($error) ?>
                </div>
                <?php endif; ?>

                <form method="POST" action="login.php" id="login-form" novalidate>
                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(getCsrfToken()) ?>">
                    <div class="form-group">
                        <label for="username" class="form-label">Usuario</label>
                        <div class="input-wrapper">
                            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/></svg>
                            <input type="text" id="username" name="username" class="form-input" placeholder="Ingresa tu usuario" autocomplete="username" required value="<?= htmlspecialchars($_POST['username'] ?? '') ?>">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="password" class="form-label">Contraseña</label>
                        <div class="input-wrapper">
                            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                            <input type="password" id="password" name="password" class="form-input" placeholder="••••••••" autocomplete="current-password" required>
                            <button type="button" class="toggle-password" id="toggle-pwd" aria-label="Mostrar contraseña">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>
                            </button>
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary btn-full" id="submit-btn">
                        <span class="btn-text">Iniciar Sesión</span>
                        <span class="btn-loading" hidden>
                            <svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                            Verificando...
                        </span>
                    </button>
                </form>

                <p class="login-footer-note">
                    MyErPharma &copy; <?= date('Y') ?> — myerpharma.free.nf
                </p>
            </div>
        </div>
    </div>

    <script src="js/login.js"></script>
</body>
</html>
