<?php
// ============================================================
//  api/historial.php — Consulta y Exportación de Kardex
//  Acciones: list | export
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

// Validar que el usuario sea administrador
if (currentUser()['role'] !== 'admin') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Acceso denegado. Se requieren permisos de administrador.']);
    exit;
}

$action = $_GET['action'] ?? '';
$db = getDB();

if ($action === 'export') {
    actionExport($db);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

match ($action) {
    'list'  => actionList($db),
    default => jsonError('Acción no reconocida.', 400),
};

// ================================================================
//  LIST — Listado paginado de movimientos con filtros
// ================================================================
function actionList(PDO $db): void {
    $q            = trim($_GET['q'] ?? '');
    $tipo_mov_id  = (int)($_GET['tipo_movimiento_id'] ?? 0);
    $fecha_desde  = trim($_GET['fecha_desde'] ?? '');
    $fecha_hasta  = trim($_GET['fecha_hasta'] ?? '');
    $page         = max(1, (int)($_GET['page'] ?? 1));
    $limit        = 50;
    $offset       = ($page - 1) * $limit;

    $where  = ['1=1'];
    $params = [];

    // Filtro por texto (Socofar o Descripción del producto)
    if ($q !== '') {
        $like = "%{$q}%";
        $where[] = "(p.cod_socofar LIKE ? OR p.descripcion LIKE ?)";
        $params[] = $like;
        $params[] = $like;
    }

    // Filtro por Tipo de Movimiento
    if ($tipo_mov_id > 0) {
        $where[] = "hm.tipo_movimiento_id = ?";
        $params[] = $tipo_mov_id;
    }

    // Filtro por Fecha Desde
    if ($fecha_desde !== '') {
        $where[] = "DATE(hm.fecha) >= ?";
        $params[] = $fecha_desde;
    }

    // Filtro por Fecha Hasta
    if ($fecha_hasta !== '') {
        $where[] = "DATE(hm.fecha) <= ?";
        $params[] = $fecha_hasta;
    }

    $whereSql = implode(' AND ', $where);

    try {
        // Conteo total
        $countSql = "
            SELECT COUNT(*) 
            FROM historial_movimientos hm
            INNER JOIN productos p ON p.id = hm.producto_id
            WHERE {$whereSql}
        ";
        $stmtCount = $db->prepare($countSql);
        $stmtCount->execute($params);
        $total = (int)$stmtCount->fetchColumn();
        $totalPages = max(1, ceil($total / $limit));

        // Consulta de datos con paginación
        $sql = "
            SELECT 
                hm.id,
                hm.fecha,
                u.username AS usuario,
                tm.nombre AS tipo_movimiento,
                hm.tipo_movimiento_id,
                p.cod_socofar,
                p.descripcion AS producto,
                l.numero_lote,
                l.fecha_vencimiento,
                uo.codigo AS origen,
                ud.codigo AS destino,
                hm.cantidad
            FROM historial_movimientos hm
            INNER JOIN usuarios u           ON u.id = hm.usuario_id
            INNER JOIN productos p          ON p.id = hm.producto_id
            INNER JOIN lotes l              ON l.id = hm.lote_id
            INNER JOIN ubicaciones uo       ON uo.id = hm.ubicacion_origen_id
            INNER JOIN ubicaciones ud       ON ud.id = hm.ubicacion_destino_id
            INNER JOIN tipo_movimiento tm  ON tm.id = hm.tipo_movimiento_id
            WHERE {$whereSql}
            ORDER BY hm.fecha DESC, hm.id DESC
            LIMIT ? OFFSET ?
        ";

        $stmt = $db->prepare($sql);
        // Bind para los parámetros de filtros
        $paramIndex = 1;
        foreach ($params as $val) {
            $stmt->bindValue($paramIndex++, $val, PDO::PARAM_STR);
        }
        // Bind para LIMIT y OFFSET (deben ser enteros)
        $stmt->bindValue($paramIndex++, $limit, PDO::PARAM_INT);
        $stmt->bindValue($paramIndex++, $offset, PDO::PARAM_INT);
        
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'ok'          => true,
            'rows'        => $rows,
            'total'       => $total,
            'page'        => $page,
            'total_pages' => $totalPages
        ]);

    } catch (PDOException $e) {
        jsonError('Error al consultar el historial: ' . $e->getMessage(), 500);
    }
}

// ================================================================
//  EXPORT — Descarga CSV del historial respetando filtros activos
// ================================================================
function actionExport(PDO $db): void {
    $q            = trim($_GET['q'] ?? '');
    $tipo_mov_id  = (int)($_GET['tipo_movimiento_id'] ?? 0);
    $fecha_desde  = trim($_GET['fecha_desde'] ?? '');
    $fecha_hasta  = trim($_GET['fecha_hasta'] ?? '');

    $where  = ['1=1'];
    $params = [];

    if ($q !== '') {
        $like = "%{$q}%";
        $where[] = "(p.cod_socofar LIKE ? OR p.descripcion LIKE ?)";
        $params[] = $like;
        $params[] = $like;
    }

    if ($tipo_mov_id > 0) {
        $where[] = "hm.tipo_movimiento_id = ?";
        $params[] = $tipo_mov_id;
    }

    if ($fecha_desde !== '') {
        $where[] = "DATE(hm.fecha) >= ?";
        $params[] = $fecha_desde;
    }

    if ($fecha_hasta !== '') {
        $where[] = "DATE(hm.fecha) <= ?";
        $params[] = $fecha_hasta;
    }

    $whereSql = implode(' AND ', $where);

    $filename = 'kardex_export_' . date('Ymd_His') . '.csv';

    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"{$filename}\"");
    header('Cache-Control: no-cache');

    // Inyectar BOM para soporte UTF-8 correcto en Excel en español
    echo "\xEF\xBB\xBF";

    $out = fopen('php://output', 'w');
    // Cabecera del archivo CSV
    fputcsv($out, ['Fecha', 'Usuario', 'Tipo Movimiento', 'Cód. Socofar', 'Producto', 'Lote', 'F. Vencimiento', 'Origen', 'Destino', 'Cantidad'], ';', '"', '\\');

    try {
        $sql = "
            SELECT 
                hm.fecha,
                u.username AS usuario,
                tm.nombre AS tipo_movimiento,
                p.cod_socofar,
                p.descripcion AS producto,
                l.numero_lote,
                l.fecha_vencimiento,
                uo.codigo AS origen,
                ud.codigo AS destino,
                hm.cantidad
            FROM historial_movimientos hm
            INNER JOIN usuarios u           ON u.id = hm.usuario_id
            INNER JOIN productos p          ON p.id = hm.producto_id
            INNER JOIN lotes l              ON l.id = hm.lote_id
            INNER JOIN ubicaciones uo       ON uo.id = hm.ubicacion_origen_id
            INNER JOIN ubicaciones ud       ON ud.id = hm.ubicacion_destino_id
            INNER JOIN tipo_movimiento tm  ON tm.id = hm.tipo_movimiento_id
            WHERE {$whereSql}
            ORDER BY hm.fecha DESC, hm.id DESC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            // Formatear fechas para mejor lectura en Excel
            $row['fecha'] = date('d/m/Y H:i:s', strtotime($row['fecha']));
            $row['fecha_vencimiento'] = date('d/m/Y', strtotime($row['fecha_vencimiento']));
            fputcsv($out, array_values($row), ';', '"', '\\');
        }

    } catch (PDOException $e) {
        // En descargas de archivos CSV de salida directa, no podemos cambiar los headers si ya se envió output,
        // pero fputcsv de una fila de error nos ayuda a diagnosticar en el archivo descargado.
        fputcsv($out, ['ERROR', 'No se pudo generar el reporte: ' . $e->getMessage()], ';', '"', '\\');
    }

    fclose($out);
}

// ---- Helpers ----
function jsonError(string $msg, int $code = 422): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}
