<?php
// ============================================================
//  api/dashboard.php — Estadísticas del Dashboard
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

header('Content-Type: application/json; charset=utf-8');

$db = getDB();

// Total productos maestros
$total_productos = $db->query("SELECT COUNT(*) FROM productos")->fetchColumn();

// Total lotes en stock (cantidad > 0)
$total_lotes = $db->query("
    SELECT COUNT(DISTINCT l.id) FROM lotes l
    INNER JOIN inventario i ON i.lote_id = l.id
    WHERE i.cantidad > 0
")->fetchColumn();

// Lotes vencidos con stock
$vencidos = $db->query("
    SELECT COUNT(*) FROM lotes l
    INNER JOIN inventario i ON i.lote_id = l.id
    WHERE i.cantidad > 0 AND l.fecha_vencimiento < CURDATE()
")->fetchColumn();

// Lotes que vencen en los próximos 90 días con stock
$proximos_vencer = $db->query("
    SELECT COUNT(*) FROM lotes l
    INNER JOIN inventario i ON i.lote_id = l.id
    WHERE i.cantidad > 0
      AND l.fecha_vencimiento >= CURDATE()
      AND l.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
")->fetchColumn();

// Detalle de los próximos a vencer (para tabla del dashboard)
$stmt = $db->query("
    SELECT
        p.cod_socofar,
        p.descripcion,
        l.numero_lote,
        l.fecha_vencimiento,
        u.codigo AS ubicacion_codigo,
        i.cantidad
    FROM inventario i
    INNER JOIN lotes l     ON l.id = i.lote_id
    INNER JOIN productos p ON p.id = l.producto_id
    INNER JOIN ubicaciones u ON u.id = i.ubicacion_id
    WHERE i.cantidad > 0
      AND l.fecha_vencimiento >= CURDATE()
      AND l.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
    ORDER BY l.fecha_vencimiento ASC
    LIMIT 20
");
$expiry_soon = $stmt->fetchAll();

echo json_encode([
    'total_productos' => (int) $total_productos,
    'total_lotes'     => (int) $total_lotes,
    'vencidos'        => (int) $vencidos,
    'proximos_vencer' => (int) $proximos_vencer,
    'expiry_soon'     => $expiry_soon,
]);
