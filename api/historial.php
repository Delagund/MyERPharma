<?php
// ============================================================
//  api/historial.php — Consulta y Exportación de Kardex (Saneado)
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/HistorialRepository.php';

requireLogin();

// Gobernanza y restricción de roles del negocio
if (currentUser()['role'] !== 'admin') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Acceso denegado. Se requieren permisos de administrador.']);
    exit;
}

// Adaptación para payloads híbridos (Web / CLI del Arnés 2)
$action = $_GET['action'] ?? ($argv[1] ?? '');
$repository = new HistorialRepository(getDB());

// --- FLUJO DE EXPORTACIÓN CSV ---
if ($action === 'export') {
    $filename = 'kardex_export_' . date('Ymd_His') . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"{$filename}\"");
    header('Cache-Control: no-cache');
    echo "\xEF\xBB\xBF"; // BOM para Excel en español

    $out = fopen('php://output', 'w');
    fputcsv($out, ['Fecha', 'Usuario', 'Tipo Movimiento', 'Cód. Socofar', 'Producto', 'Lote', 'F. Vencimiento', 'Origen', 'Destino', 'Cantidad'], ';', '"', '\\');

    try {
        $stmt = $repository->obtenerCursorExportacion($_GET);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $row['fecha'] = date('d/m/Y H:i:s', strtotime($row['fecha']));
            $row['fecha_vencimiento'] = date('d/m/Y', strtotime($row['fecha_vencimiento']));
            fputcsv($out, array_values($row), ';', '"', '\\');
        }
    } catch (PDOException $e) {
        fputcsv($out, ['ERROR', 'No se pudo generar el reporte: ' . $e->getMessage()], ';', '"', '\\');
    }
    fclose($out);
    exit;
}

// --- FLUJO DE LISTADO JSON ---
header('Content-Type: application/json; charset=utf-8');

if ($action === 'list') {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = 50;

    try {
        $res = $repository->obtenerListado($_GET, $page, $limit);
        echo json_encode([
            'ok'          => true,
            'rows'        => $res['rows'],
            'total'       => $res['total'],
            'page'        => $page,
            'total_pages' => max(1, (int)ceil($res['total'] / $limit))
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Error al consultar el historial: ' . $e->getMessage()]);
    }
    exit;
}

// Acción no válida o por defecto
http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Acción no reconocida.']);