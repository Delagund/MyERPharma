<?php
// ============================================================
//  api/consulta_reglas.php — Búsqueda de reglas de canje
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

header('Content-Type: application/json; charset=utf-8');

$q = $_GET['q'] ?? '';

if (strlen(trim($q)) < 2) {
    echo json_encode(['ok' => true, 'rows' => []]);
    exit;
}

$db = getDB();

try {
    $likeQ = '%' . trim($q) . '%';
    
    $sql = "
        SELECT 
            p.cod_socofar, 
            p.descripcion, 
            GROUP_CONCAT(DISTINCT cb.cod_barra SEPARATOR ', ') AS codigo_barras, 
            IFNULL(r.tiene_canje, 0) AS tiene_canje, 
            r.mes_vencimiento_devolver,
            r.laboratorio
        FROM productos p
        LEFT JOIN codigos_barra cb ON p.id = cb.producto_id
        LEFT JOIN (
            SELECT 
                cod_socofar, 
                MAX(tiene_canje) AS tiene_canje,
                MAX(mes_vencimiento_devolver) AS mes_vencimiento_devolver,
                MAX(laboratorio) AS laboratorio
            FROM reglas_devolucion
            GROUP BY cod_socofar
        ) r ON p.cod_socofar = r.cod_socofar
        WHERE p.cod_socofar LIKE ? 
           OR p.descripcion LIKE ? 
           OR cb.cod_barra LIKE ?
        GROUP BY p.id
        ORDER BY p.descripcion ASC
        LIMIT 50
    ";
    
    $stmt = $db->prepare($sql);
    $stmt->execute([$likeQ, $likeQ, $likeQ]);
    $rows = $stmt->fetchAll();

    echo json_encode(['ok' => true, 'rows' => $rows]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Error al consultar reglas: ' . $e->getMessage()]);
}
