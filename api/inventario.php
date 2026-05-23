<?php
// ============================================================
//  api/inventario.php — Movimientos de Inventario
//  Acciones: entrada | salida | list | stock_by_product |
//            expiry_alerts | export
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

$action = $_GET['action'] ?? '';

// export no necesita header JSON
if ($action === 'export') {
    actionExport(getDB());
    exit;
}

header('Content-Type: application/json; charset=utf-8');
$db = getDB();

match ($action) {
    'entrada'          => actionEntrada($db),
    'salida'           => actionSalida($db),
    'traslado'         => actionTraslado($db),
    'list'             => actionList($db),
    'stock_by_product' => actionStockByProduct($db),
    'expiry_alerts'    => actionExpiryAlerts($db),
    default            => jsonError('Acción no reconocida.', 400),
};

// ================================================================
//  ENTRADA — Registrar almacenamiento de un lote en una ubicación
// ================================================================
function actionEntrada(PDO $db): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonError('Método no permitido.', 405); return; }
    $body = jsonBody();

    $producto_id      = (int)($body['producto_id']      ?? 0);
    $numero_lote      = trim($body['numero_lote']       ?? '');
    $fecha_vencimiento = trim($body['fecha_vencimiento'] ?? '');
    $ubicacion_id     = (int)($body['ubicacion_id']      ?? 0);
    $cantidad         = (int)($body['cantidad']           ?? 0);

    // Validaciones
    if (!$producto_id)       { jsonError('Producto inválido.');            return; }
    if ($numero_lote === '')  { jsonError('Número de lote requerido.');    return; }
    if (!$fecha_vencimiento)  { jsonError('Fecha de vencimiento requerida.'); return; }
    if (!$ubicacion_id)       { jsonError('Ubicación requerida.');         return; }
    if ($ubicacion_id === 1)  { jsonError('No se puede almacenar stock directamente en la ubicación EXTERIOR del sistema.'); return; }
    if ($cantidad < 1)        { jsonError('La cantidad debe ser mayor a 0.'); return; }

    // Validar fecha
    $fechaObj = DateTime::createFromFormat('Y-m-d', $fecha_vencimiento);
    if (!$fechaObj) { jsonError('Formato de fecha inválido. Use YYYY-MM-DD.'); return; }

    try {
        $db->beginTransaction();

        // 1) Obtener o crear el lote (producto_id + numero_lote = unique)
        $stmt = $db->prepare("
            SELECT id FROM lotes
            WHERE producto_id = ? AND numero_lote = ?
        ");
        $stmt->execute([$producto_id, $numero_lote]);
        $lote = $stmt->fetch();

        if ($lote) {
            $lote_id = $lote['id'];
            // Actualizar fecha de vencimiento si el lote ya existe
            $db->prepare("UPDATE lotes SET fecha_vencimiento = ? WHERE id = ?")
               ->execute([$fecha_vencimiento, $lote_id]);
        } else {
            $db->prepare("
                INSERT INTO lotes (producto_id, numero_lote, fecha_vencimiento)
                VALUES (?, ?, ?)
            ")->execute([$producto_id, $numero_lote, $fecha_vencimiento]);
            $lote_id = (int) $db->lastInsertId();
        }

        // 2) Obtener o crear el registro de inventario (lote + ubicación)
        $stmt = $db->prepare("
            SELECT id, cantidad FROM inventario
            WHERE lote_id = ? AND ubicacion_id = ?
        ");
        $stmt->execute([$lote_id, $ubicacion_id]);
        $inv = $stmt->fetch();

        if ($inv) {
            // Sumar al stock existente
            $db->prepare("UPDATE inventario SET cantidad = cantidad + ? WHERE id = ?")
               ->execute([$cantidad, $inv['id']]);
            $nuevo_stock = $inv['cantidad'] + $cantidad;
        } else {
            $db->prepare("
                INSERT INTO inventario (lote_id, ubicacion_id, cantidad)
                VALUES (?, ?, ?)
            ")->execute([$lote_id, $ubicacion_id, $cantidad]);
            $nuevo_stock = $cantidad;
        }

        // 3) Registrar movimiento en el historial (Kardex)
        // Origen: 1 (EXTERIOR), Destino: $ubicacion_id, Tipo: 1 (Entrada)
        $usuario_id = currentUser()['id'];
        $db->prepare("
            INSERT INTO historial_movimientos (usuario_id, producto_id, lote_id, ubicacion_origen_id, ubicacion_destino_id, tipo_movimiento_id, cantidad)
            VALUES (?, ?, ?, 1, ?, 1, ?)
        ")->execute([$usuario_id, $producto_id, $lote_id, $ubicacion_id, $cantidad]);

        $db->commit();

        // 4) Registrar en log inalterable en disco (Failsafe)
        writeKardexFailsafeLog($usuario_id, 'Entrada', $producto_id, $lote_id, 1, $ubicacion_id, $cantidad);

        echo json_encode(['ok' => true, 'nuevo_stock' => $nuevo_stock, 'lote_id' => $lote_id]);

    } catch (PDOException $e) {
        $db->rollBack();
        jsonError('Error al registrar entrada: ' . $e->getMessage());
    }
}

// ================================================================
//  SALIDA — Descontar cantidad de un registro de inventario
// ================================================================
function actionSalida(PDO $db): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonError('Método no permitido.', 405); return; }
    $body = jsonBody();

    $inventario_id = (int)($body['inventario_id'] ?? 0);
    $cantidad      = (int)($body['cantidad']       ?? 0);

    if (!$inventario_id) { jsonError('Registro de inventario inválido.'); return; }
    if ($cantidad < 1)   { jsonError('La cantidad debe ser mayor a 0.');  return; }

    try {
        $db->beginTransaction();

        // Bloquear fila y obtener información asociada para el Kardex
        $stmt = $db->prepare("
            SELECT i.id, i.cantidad, i.lote_id, i.ubicacion_id, l.producto_id
            FROM inventario i
            INNER JOIN lotes l ON l.id = i.lote_id
            WHERE i.id = ?
            FOR UPDATE
        ");
        $stmt->execute([$inventario_id]);
        $inv = $stmt->fetch();

        if (!$inv) { $db->rollBack(); jsonError('Registro no encontrado.', 404); return; }

        if ($cantidad > $inv['cantidad']) {
            $db->rollBack();
            jsonError("Stock insuficiente. Disponible: {$inv['cantidad']} unidades.");
            return;
        }

        $nuevo_stock = $inv['cantidad'] - $cantidad;
        $eliminado   = false;

        if ($nuevo_stock === 0) {
            // Eliminar el registro de inventario (producto desaparece de esa ubicación)
            $db->prepare("DELETE FROM inventario WHERE id = ?")->execute([$inventario_id]);
            $eliminado = true;
        } else {
            $db->prepare("UPDATE inventario SET cantidad = ? WHERE id = ?")
               ->execute([$nuevo_stock, $inventario_id]);
        }

        // Registrar en historial_movimientos (Kardex)
        // Origen: $inv['ubicacion_id'], Destino: 1 (EXTERIOR), Tipo: 2 (Salida)
        $usuario_id = currentUser()['id'];
        $db->prepare("
            INSERT INTO historial_movimientos (usuario_id, producto_id, lote_id, ubicacion_origen_id, ubicacion_destino_id, tipo_movimiento_id, cantidad)
            VALUES (?, ?, ?, ?, 1, 2, ?)
        ")->execute([$usuario_id, $inv['producto_id'], $inv['lote_id'], $inv['ubicacion_id'], $cantidad]);

        $db->commit();

        // Registrar en log inalterable en disco (Failsafe)
        writeKardexFailsafeLog($usuario_id, 'Salida', $inv['producto_id'], $inv['lote_id'], $inv['ubicacion_id'], 1, $cantidad);

        echo json_encode([
            'ok'          => true,
            'nuevo_stock' => $nuevo_stock,
            'eliminado'   => $eliminado,
        ]);

    } catch (PDOException $e) {
        $db->rollBack();
        jsonError('Error al registrar salida: ' . $e->getMessage());
    }
}

// ================================================================
//  LIST — Listado completo del inventario (con búsqueda)
// ================================================================
function actionList(PDO $db): void {
    $q           = trim($_GET['q'] ?? '');
    $filter      = $_GET['filter'] ?? '';
    $expiry_days = (int)($_GET['expiry_days'] ?? 0);
    $page        = max(1, (int)($_GET['page'] ?? 1));
    $limit       = 50;
    $offset      = ($page - 1) * $limit;

    $where  = ['i.cantidad > 0'];
    $params = [];

    if ($q !== '') {
        $like = "%{$q}%";
        $where[]  = "(
            p.cod_socofar LIKE ? OR 
            p.descripcion LIKE ? OR 
            l.numero_lote LIKE ? OR 
            u.codigo LIKE ? OR
            EXISTS (SELECT 1 FROM codigos_barra cb WHERE cb.producto_id = p.id AND cb.cod_barra LIKE ?)
        )";
        $params   = array_merge($params, [$like, $like, $like, $like, $like]);
    }

    if ($expiry_days > 0) {
        $where[] = "l.fecha_vencimiento >= CURDATE()";
        $where[] = "l.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY)";
        $params[] = $expiry_days;
    }

    if ($filter === 'expiry30') {
        $where[] = "l.fecha_vencimiento >= CURDATE()";
        $where[] = "l.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)";
    } elseif ($filter === 'vencidos') {
        $where[] = "l.fecha_vencimiento < CURDATE()";
    }

    $whereSql = implode(' AND ', $where);

    // Conteo total
    $countSql = "
        SELECT COUNT(*)
        FROM inventario i
        INNER JOIN lotes l     ON l.id = i.lote_id
        INNER JOIN productos p ON p.id = l.producto_id
        INNER JOIN ubicaciones u ON u.id = i.ubicacion_id
        WHERE {$whereSql}
    ";
    $stmtCount = $db->prepare($countSql);
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $totalPages = max(1, ceil($total / $limit));

    // Data query con paginación
    $params[] = $limit;
    $params[] = $offset;
    $sql = "
        SELECT
            i.id,
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
        WHERE {$whereSql}
        ORDER BY l.fecha_vencimiento ASC, p.descripcion
        LIMIT ? OFFSET ?
    ";

    $stmt = $db->prepare($sql);
    // Bind all params correctly mixed since LIMIT/OFFSET need integers, executing PDO with array forces strings by default in some drivers,
    // but in MySQL it often works. If strict mode on, maybe need bindValue. We'll use bindValue loop to be safe.
    foreach ($params as $key => $val) {
        $stmt->bindValue($key + 1, $val, is_int($val) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->execute();

    echo json_encode([
        'rows' => $stmt->fetchAll(PDO::FETCH_ASSOC),
        'total' => $total,
        'page' => $page,
        'total_pages' => $totalPages
    ]);
}

// ================================================================
//  STOCK_BY_PRODUCT — Ubicaciones/lotes donde está un producto
// ================================================================
function actionStockByProduct(PDO $db): void {
    $producto_id = (int)($_GET['producto_id'] ?? 0);
    if (!$producto_id) { jsonError('producto_id requerido.'); return; }

    $stmt = $db->prepare("
        SELECT
            i.id,
            l.numero_lote,
            l.fecha_vencimiento,
            u.codigo AS ubicacion_codigo,
            i.cantidad
        FROM inventario i
        INNER JOIN lotes l     ON l.id = i.lote_id
        INNER JOIN ubicaciones u ON u.id = i.ubicacion_id
        WHERE l.producto_id = ? AND i.cantidad > 0
        ORDER BY l.fecha_vencimiento ASC, u.codigo
    ");
    $stmt->execute([$producto_id]);
    echo json_encode(['rows' => $stmt->fetchAll()]);
}

// ================================================================
//  EXPIRY_ALERTS — Listado o conteo de lotes próximos a vencer
// ================================================================
function actionExpiryAlerts(PDO $db): void {
    $days = max(1, (int)($_GET['days'] ?? 30));
    $format = $_GET['format'] ?? 'count'; // 'count' o 'list'

    if ($format === 'list') {
        $stmt = $db->prepare("
            SELECT 
                p.descripcion, 
                l.numero_lote, 
                l.fecha_vencimiento, 
                u.codigo AS ubicacion,
                SUM(i.cantidad) AS stock_total,
                DATEDIFF(l.fecha_vencimiento, CURDATE()) AS dias_para_vencer
            FROM inventario i
            JOIN lotes l ON i.lote_id = l.id
            JOIN productos p ON l.producto_id = p.id
            JOIN ubicaciones u ON i.ubicacion_id = u.id
            WHERE i.cantidad > 0 
              AND l.fecha_vencimiento >= CURDATE()
              AND l.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
            GROUP BY i.lote_id, i.ubicacion_id
            ORDER BY l.fecha_vencimiento ASC
        ");
        $stmt->execute([$days]);
        echo json_encode(['rows' => $stmt->fetchAll(), 'days' => $days]);
    } else {
        $stmt = $db->prepare("
            SELECT COUNT(DISTINCT l.id) 
            FROM lotes l
            INNER JOIN inventario i ON i.lote_id = l.id
            WHERE i.cantidad > 0
              AND l.fecha_vencimiento >= CURDATE()
              AND l.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
        ");
        $stmt->execute([$days]);
        echo json_encode(['count' => (int) $stmt->fetchColumn(), 'days' => $days]);
    }
}

// ================================================================
//  EXPORT — Descarga CSV del inventario
// ================================================================
function actionExport(PDO $db): void {
    $filter = $_GET['filter'] ?? '';

    $where  = ['i.cantidad > 0'];
    if ($filter === 'expiry30') {
        $where[] = "l.fecha_vencimiento >= CURDATE()";
        $where[] = "l.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)";
    } elseif ($filter === 'vencidos') {
        $where[] = "l.fecha_vencimiento < CURDATE()";
    }

    $filename = match($filter) {
        'expiry30'  => 'vencimiento_30dias',
        'vencidos'  => 'lotes_vencidos',
        default     => 'inventario_completo',
    };
    $filename .= '_' . date('Ymd') . '.csv';

    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"{$filename}\"");
    header('Cache-Control: no-cache');

    // BOM para Excel con UTF-8
    echo "\xEF\xBB\xBF";

    $out = fopen('php://output', 'w');
    fputcsv($out, ['Cod Socofar', 'Descripción', 'Número Lote', 'Fecha Vencimiento', 'Cód. Ubicación', 'Desc. Ubicación', 'Cantidad'], ';');

    $sql = "
        SELECT p.cod_socofar, p.descripcion, l.numero_lote,
               l.fecha_vencimiento, u.codigo AS ubicacion_codigo, 
               u.descripcion AS ubicacion_descripcion, i.cantidad
        FROM inventario i
        INNER JOIN lotes l      ON l.id = i.lote_id
        INNER JOIN productos p  ON p.id = l.producto_id
        INNER JOIN ubicaciones u ON u.id = i.ubicacion_id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY l.fecha_vencimiento ASC, p.descripcion
    ";

    $stmt = $db->query($sql);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $row['fecha_vencimiento'] = date('d/m/Y', strtotime($row['fecha_vencimiento']));
        fputcsv($out, array_values($row), ';');
    }
    fclose($out);
}

// ================================================================
//  TRASLADO — Mover cantidad entre dos ubicaciones (Atómico)
// ================================================================
function actionTraslado(PDO $db): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonError('Método no permitido.', 405); return; }
    $body = jsonBody();

    $inventario_id        = (int)($body['inventario_id']        ?? 0);
    $ubicacion_destino_id = (int)($body['ubicacion_destino_id'] ?? 0);
    $cantidad             = (int)($body['cantidad']             ?? 0);

    if (!$inventario_id)        { jsonError('Registro de inventario origen inválido.'); return; }
    if (!$ubicacion_destino_id) { jsonError('Ubicación de destino requerida.');          return; }
    if ($ubicacion_destino_id === 1) { jsonError('No se puede trasladar stock a la ubicación EXTERIOR del sistema. Para retirar stock, realice una Salida.'); return; }
    if ($cantidad < 1)          { jsonError('La cantidad debe ser mayor a 0.');        return; }

    try {
        $db->beginTransaction();

        // 1) Obtener y bloquear origen para asegurar stock, incluyendo producto_id
        $stmt = $db->prepare("
            SELECT i.lote_id, i.ubicacion_id, i.cantidad, l.producto_id 
            FROM inventario i 
            INNER JOIN lotes l ON l.id = i.lote_id
            WHERE i.id = ? 
            FOR UPDATE
        ");
        $stmt->execute([$inventario_id]);
        $origen = $stmt->fetch();

        if (!$origen) {
            $db->rollBack();
            jsonError('El registro de inventario origen no existe.', 404);
            return;
        }

        if ((int)$origen['ubicacion_id'] === 1) {
            $db->rollBack();
            jsonError('No se puede realizar traslados desde la ubicación EXTERIOR del sistema.');
            return;
        }

        if ($origen['ubicacion_id'] == $ubicacion_destino_id) {
            $db->rollBack();
            jsonError('La ubicación de destino debe ser diferente a la de origen.');
            return;
        }

        if ($cantidad > $origen['cantidad']) {
            $db->rollBack();
            jsonError("Stock insuficiente en origen. Disponible: {$origen['cantidad']} unidades.");
            return;
        }

        // 2) Validar que el destino existe en el maestro y que no es la de sistema (ID 1)
        $stmt = $db->prepare("SELECT id FROM ubicaciones WHERE id = ?");
        $stmt->execute([$ubicacion_destino_id]);
        if (!$stmt->fetch()) {
            $db->rollBack();
            jsonError('La ubicación de destino no existe.', 404);
            return;
        }

        $lote_id = $origen['lote_id'];

        // 3) Procesar Salida Origen
        $nuevo_stock_origen = $origen['cantidad'] - $cantidad;
        if ($nuevo_stock_origen === 0) {
            $db->prepare("DELETE FROM inventario WHERE id = ?")->execute([$inventario_id]);
        } else {
            $db->prepare("UPDATE inventario SET cantidad = ? WHERE id = ?")->execute([$nuevo_stock_origen, $inventario_id]);
        }

        // 4) Procesar Entrada Destino (Lote + Nueva Ubicación)
        $stmt = $db->prepare("SELECT id, cantidad FROM inventario WHERE lote_id = ? AND ubicacion_id = ? FOR UPDATE");
        $stmt->execute([$lote_id, $ubicacion_destino_id]);
        $dest = $stmt->fetch();

        if ($dest) {
            $db->prepare("UPDATE inventario SET cantidad = cantidad + ? WHERE id = ?")->execute([$cantidad, $dest['id']]);
            $nuevo_stock_destino = $dest['cantidad'] + $cantidad;
        } else {
            $db->prepare("INSERT INTO inventario (lote_id, ubicacion_id, cantidad) VALUES (?, ?, ?)")->execute([$lote_id, $ubicacion_destino_id, $cantidad]);
            $nuevo_stock_destino = $cantidad;
        }

        // 5) Registrar en historial_movimientos (Kardex)
        // Origen: $origen['ubicacion_id'], Destino: $ubicacion_destino_id, Tipo: 3 (Traspaso)
        $usuario_id = currentUser()['id'];
        $db->prepare("
            INSERT INTO historial_movimientos (usuario_id, producto_id, lote_id, ubicacion_origen_id, ubicacion_destino_id, tipo_movimiento_id, cantidad)
            VALUES (?, ?, ?, ?, ?, 3, ?)
        ")->execute([$usuario_id, $origen['producto_id'], $lote_id, $origen['ubicacion_id'], $ubicacion_destino_id, $cantidad]);

        $db->commit();

        // 6) Registrar en log inalterable en disco (Failsafe)
        writeKardexFailsafeLog($usuario_id, 'Traslado', $origen['producto_id'], $lote_id, $origen['ubicacion_id'], $ubicacion_destino_id, $cantidad);

        echo json_encode([
            'ok' => true,
            'nuevo_stock_origen'  => $nuevo_stock_origen,
            'nuevo_stock_destino' => $nuevo_stock_destino,
            'lote_id'             => $lote_id
        ]);

    } catch (PDOException $e) {
        if ($db->inTransaction()) $db->rollBack();
        jsonError('Error al procesar el traslado: ' . $e->getMessage());
    }
}

// ---- Helpers ----
function jsonBody(): array {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function jsonError(string $msg, int $code = 422): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

/**
 * Escribe un registro secuencial estructurado en un archivo local .jsonl
 * como bitácora de respaldo en tiempo real (Kardex "caja negra").
 */
function writeKardexFailsafeLog(int $usuario_id, string $tipo, int $producto_id, int $lote_id, int $origen_id, int $destino_id, int $cantidad): void {
    try {
        $dir = __DIR__ . '/../backups';
        
        // Crear directorio de backups de forma segura (silenciando warnings por falta de permisos)
        if (!is_dir($dir)) {
            if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
                return; // Si no se puede crear, salir silenciosamente para no interrumpir el flujo del usuario
            }
        }
        
        // Comprobar que sea escribible
        if (!is_writable($dir)) {
            return;
        }

        // Asegurar protección del directorio backups mediante .htaccess
        $htaccessFile = $dir . '/.htaccess';
        if (!file_exists($htaccessFile)) {
            @file_put_contents($htaccessFile, "Deny from all\n");
        }

        $logEntry = json_encode([
            'timestamp'   => date('Y-m-d H:i:s'),
            'usuario_id'  => $usuario_id,
            'tipo'        => $tipo,
            'producto_id' => $producto_id,
            'lote_id'     => $lote_id,
            'origen_id'   => $origen_id,
            'destino_id'  => $destino_id,
            'cantidad'    => $cantidad
        ], JSON_UNESCAPED_UNICODE) . "\n";

        @file_put_contents($dir . '/kardex.jsonl', $logEntry, FILE_APPEND | LOCK_EX);
    } catch (\Throwable $e) {
        // Ignorar silenciosamente errores de escritura para garantizar que la transacción en DB se complete
    }
}
