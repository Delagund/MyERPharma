<?php
// ============================================================
//  api/reportes_canjes.php — Reporte de Logística Inversa
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

header('Content-Type: application/json; charset=utf-8');

$db = getDB();

try {
    $sql = "
    SELECT
        p.cod_socofar,
        p.descripcion,
        l.numero_lote,
        l.fecha_vencimiento,
        i.cantidad,
        u.codigo AS ubicacion,
        u.descripcion AS ubicacion_nombre,
        IFNULL(r.tiene_canje, 0) AS aplica_canje,
        r.mes_vencimiento_devolver,
        CASE
            WHEN r.tiene_canje = 1 THEN 'Canje habilitado'
            WHEN r.cod_socofar IS NOT NULL AND r.tiene_canje = 0 THEN 'Sin canje (Baja)'
            ELSE 'Vencimiento común (3 meses)'
        END as tipo_alerta
    FROM inventario i
    JOIN lotes l ON i.lote_id = l.id
    JOIN productos p ON l.producto_id = p.id
    JOIN ubicaciones u ON i.ubicacion_id = u.id
    LEFT JOIN (
        SELECT 
            cod_socofar,
            MAX(tiene_canje) AS tiene_canje,
            MAX(mes_vencimiento_devolver) AS mes_vencimiento_devolver
        FROM reglas_devolucion
        GROUP BY cod_socofar
    ) r ON p.cod_socofar = r.cod_socofar
    WHERE i.cantidad > 0
      AND (
          -- CASO 1: Está en el CSV y tiene ventana de canje permitida
          (r.tiene_canje = 1 AND l.fecha_vencimiento <= r.mes_vencimiento_devolver)
          OR
          -- CASO 2: No tiene canje o no está en el CSV, alertar por política de 3 meses
          ((r.cod_socofar IS NULL OR r.tiene_canje = 0) AND l.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH))
      )
    ORDER BY l.fecha_vencimiento ASC;
    ";

    $stmt = $db->query($sql);
    $rows = $stmt->fetchAll();

    if (isset($_GET['export']) && $_GET['export'] === '1') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="Reporte_Canjes_' . date('Ymd') . '.csv"');
        $output = fopen('php://output', 'w');
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF)); // BOM for Excel
        fputcsv($output, ['Cód. Ubicación', 'Nombre Ubicación', 'Código', 'Producto', 'Lote', 'Vencimiento', 'Cantidad', 'Tiene Canje', 'Alerta'], ';');
        
        foreach ($rows as $r) {
            fputcsv($output, [
                $r['ubicacion'],
                $r['ubicacion_nombre'],
                $r['cod_socofar'],
                $r['descripcion'],
                $r['numero_lote'],
                $r['fecha_vencimiento'],
                $r['cantidad'],
                $r['aplica_canje'] ? 'SI' : 'NO',
                $r['tipo_alerta']
            ], ';');
        }
        fclose($output);
        exit;
    }

    echo json_encode(['ok' => true, 'rows' => $rows]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Error al generar el reporte: ' . $e->getMessage()]);
}
