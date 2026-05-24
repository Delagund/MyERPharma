<?php
require_once __DIR__ . '/includes/auth.php';
$version = require_once __DIR__ . '/includes/version.php';
requireLogin();

$user = currentUser();

$page = $_GET['p'] ?? 'dashboard';
$allowedPages = ['dashboard', 'entrada', 'salida', 'traslado', 'inventario', 'productos', 'ubicaciones', 'reportes', 'perfil', 'logistica', 'historial', 'changelog'];
if (!in_array($page, $allowedPages)) {
    $page = 'dashboard';
}

$pageTitles = [
    'dashboard'   => 'Dashboard',
    'entrada'     => 'Entrada de Productos',
    'salida'      => 'Salida de Productos',
    'traslado'    => 'Cambio de Ubicación',
    'inventario'  => 'Inventario',
    'productos'   => 'Mantenedor de Productos',
    'ubicaciones' => 'Ubicaciones',
    'reportes'    => 'Reportes',
    'perfil'      => 'Configuración de Cuenta',
    'logistica'   => 'Logística Inversa',
    'historial'   => 'Historial de Movimientos',
    'changelog'   => 'Notas de Versión',
];
$pageTitle = $pageTitles[$page];
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($pageTitle) ?> — MyErPharma</title>
    <meta name="description" content="MyErPharma - Sistema de gestión de inventario y caducidades farmacéuticas.">
    <meta name="csrf-token" content="<?= htmlspecialchars(getCsrfToken()) ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
</head>
<body>

<div class="app-layout">

    <!-- Sidebar Overlay (Móvil) -->
    <div class="sidebar-overlay" id="sidebar-overlay"></div>

    <!-- ===== SIDEBAR ===== -->
    <aside class="sidebar" id="sidebar" role="navigation" aria-label="Menú principal">
        <div class="sidebar-header">
            <div class="sidebar-logo">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2v20M2 12h20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
            </div>
            <div>
                <div class="brand-title-group">
                    <span class="sidebar-title">MyErPharma</span>
                    <a href="?p=changelog" class="sidebar-version-link">
                        <span class="sidebar-version">v<?= htmlspecialchars($version) ?></span>
                    </a>
                </div>
                <div class="sidebar-subtitle">Control de Inventario</div>
            </div>
        </div>

        <nav class="sidebar-nav">
            <span class="nav-section-label">Principal</span>

            <a href="?p=dashboard" id="nav-dashboard"
               class="nav-item <?= $page === 'dashboard' ? 'active' : '' ?>">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="2"/>
                    <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="2"/>
                    <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="2"/>
                    <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="2"/>
                </svg>
                Dashboard
            </a>

            <span class="nav-section-label">Movimientos</span>

            <a href="?p=entrada" id="nav-entrada"
               class="nav-item <?= $page === 'entrada' ? 'active' : '' ?>">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Entrada de Productos
            </a>

            <a href="?p=salida" id="nav-salida"
               class="nav-item <?= $page === 'salida' ? 'active' : '' ?>">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Salida de Productos
            </a>

            <a href="?p=traslado" id="nav-traslado"
               class="nav-item <?= $page === 'traslado' ? 'active' : '' ?>">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M17 10l3-3-3-3M20 7H4M7 14l-3 3 3 3M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Cambio de Ubicación
            </a>

            <a href="?p=logistica" id="nav-logistica"
               class="nav-item <?= $page === 'logistica' ? 'active' : '' ?>">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4h16v16H4V4zm4 4v8m8-8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Logística Inversa
            </a>

            <span class="nav-section-label">Consulta</span>

            <a href="?p=inventario" id="nav-inventario"
               class="nav-item <?= $page === 'inventario' ? 'active' : '' ?>">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" stroke-width="2"/>
                    <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="2"/>
                    <path d="M9 12h6M9 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Inventario
            </a>

            <?php
            $isAdmin = ($user['role'] === 'admin');
            ?>
            <a href="<?= $isAdmin ? '?p=historial' : '#' ?>" id="nav-historial"
               class="nav-item <?= $page === 'historial' ? 'active' : '' ?> <?= !$isAdmin ? 'nav-item-disabled' : '' ?>"
               <?= !$isAdmin ? 'title="Solo disponible para administradores"' : '' ?>>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Historial (Kardex)
            </a>

            <a href="?p=reportes" id="nav-reportes"
               class="nav-item <?= $page === 'reportes' ? 'active' : '' ?>">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M21 21H3M21 21V13h-4M17 21V9h-4m4 0V3H7v6M13 21V13H9m-6 0v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Reportes
            </a>

            <span class="nav-section-label">Configuración</span>

            <a href="?p=productos" id="nav-productos"
               class="nav-item <?= $page === 'productos' ? 'active' : '' ?>">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Mantenedor Productos
            </a>

            <a href="?p=ubicaciones" id="nav-ubicaciones"
               class="nav-item <?= $page === 'ubicaciones' ? 'active' : '' ?>">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" stroke="currentColor" stroke-width="2"/>
                    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="2"/>
                </svg>
                Ubicaciones
            </a>

            <a href="?p=perfil" id="nav-perfil"
               class="nav-item <?= $page === 'perfil' ? 'active' : '' ?>">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 7a4 4 0 110-8 4 4 0 010 8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Mi Perfil
            </a>
        </nav>

        <div class="sidebar-footer">
            <div class="user-info">
                <div class="user-avatar"><?= strtoupper(substr($user['username'], 0, 1)) ?></div>
                <div>
                    <div class="user-name"><?= htmlspecialchars($user['username']) ?></div>
                    <div class="user-role"><?= htmlspecialchars($user['role']) ?></div>
                </div>
            </div>
            <a href="logout.php" class="logout-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Cerrar Sesión
            </a>
            </div>
            </aside>

            <!-- ===== CONTENIDO PRINCIPAL ===== -->
            <main class="main-content">

            <!-- Topbar -->
            <header class="topbar">
            <button class="topbar-menu-btn btn-icon" id="menu-btn" aria-label="Abrir menú">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
            <h1 class="topbar-title"><?= htmlspecialchars($pageTitle) ?></h1>
            <div class="topbar-right">
                <div class="topbar-badge" id="expiry-alert" style="display:none">
                    ⚠️ <span id="expiry-count">0</span> <span class="hide-mobile">vencimientos próximos</span>
                </div>
            </div>
            </header>

            <!-- Área de contenido de página -->
            <div class="page-content" id="page-content">
            <div class="loading-spinner">
                <svg class="spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Cargando...
            </div>
            </div>

            </main>
            </div>

            <script>
            // Pasar estado de la página actual al JS
            const APP_PAGE = '<?= $page ?>';
            const APP_USER = <?= json_encode($user) ?>;
            const APP_VERSION = '<?= htmlspecialchars($version) ?>';
            </script>
            <script src="js/logistica.js"></script>
            <script src="js/dashboard.js"></script>
            <script src="js/movimientos.js"></script>
            <script src="js/inventario.js"></script>
            <script src="js/productos.js"></script>
            <script src="js/ubicaciones.js"></script>
            <script src="js/historial.js"></script>
            <script src="js/changelog.js"></script>
            <script src="js/perfil.js"></script>
            <script src="js/app.js"></script>
            </body>
            </html>
