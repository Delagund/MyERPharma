<?php
// ============================================================
//  api/productos.php — CRUD de Productos Maestros
//  Acciones: search | list | create | update
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

header('Content-Type: application/json; charset=utf-8');

$db     = getDB();
$action = $_GET['action'] ?? '';

match ($action) {
    'search' => actionSearch($db),
    'list'   => actionList($db),
    'get'    => actionGet($db),
    'create' => actionCreate($db),
    'update' => actionUpdate($db),
    default  => jsonError('Acción no reconocida.', 400),
};

// ---- SEARCH (autocomplete) ----
// Busca por cod_socofar, descripcion o cod_barra. Prioriza exactitud.
function actionSearch(PDO $db): void {
    $q = trim($_GET['q'] ?? '');
    if (strlen($q) < 1) { echo json_encode(['results' => []]); return; }

    $like = "%{$q}%";
    // Consulta optimizada: Prioriza Socofar exacto -> Código barra exacto -> Descripción parcial
    $stmt = $db->prepare("
        (SELECT p.id, p.cod_socofar, p.descripcion, 'exact_socofar' as match_type
         FROM productos p
         WHERE p.cod_socofar = ?)
        UNION
        (SELECT p.id, p.cod_socofar, p.descripcion, 'exact_barcode' as match_type
         FROM productos p
         INNER JOIN codigos_barra cb ON cb.producto_id = p.id
         WHERE cb.cod_barra = ?)
        UNION
        (SELECT p.id, p.cod_socofar, p.descripcion, 'partial' as match_type
         FROM productos p
         WHERE p.descripcion LIKE ?
         LIMIT 10)
        LIMIT 10
    ");
    
    $stmt->execute([$q, $q, $like]);
    echo json_encode(['results' => $stmt->fetchAll()]);
}

// ---- LIST (tabla mantenedor) ----
// Agrupa los codigos_barra por producto para mostrarlos juntos.
// Soporta búsqueda y paginación.
function actionList(PDO $db): void {
    $q      = trim($_GET['q'] ?? '');
    $page   = max(1, (int)($_GET['page'] ?? 1));
    $limit  = max(10, min(500, (int)($_GET['limit'] ?? 30))); // Default 30
    $offset = ($page - 1) * $limit;

    $whereSql = "1=1";
    $params = [];

    if ($q !== '') {
        $like = "%{$q}%";
        $whereSql = "(p.cod_socofar LIKE ? OR p.descripcion LIKE ? OR cb.cod_barra LIKE ?)";
        $params = [$like, $like, $like];
    }

    // Conteo total para paginación
    $countStmt = $db->prepare("
        SELECT COUNT(DISTINCT p.id)
        FROM productos p
        LEFT JOIN codigos_barra cb ON cb.producto_id = p.id
        WHERE $whereSql
    ");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Consulta de datos
    $sql = "
        SELECT p.id, p.cod_socofar, p.descripcion,
               GROUP_CONCAT(cb.cod_barra ORDER BY cb.id SEPARATOR ' | ') AS codigos_barra
        FROM productos p
        LEFT JOIN codigos_barra cb ON cb.producto_id = p.id
        WHERE $whereSql
        GROUP BY p.id
        ORDER BY p.cod_socofar
        LIMIT ? OFFSET ?
    ";
    
    $stmt = $db->prepare($sql);
    
    // Bind de parámetros de búsqueda (strings)
    $i = 1;
    foreach ($params as $p) {
        $stmt->bindValue($i++, $p, PDO::PARAM_STR);
    }
    // Bind de paginación (integers) - Crucial para compatibilidad de algunos servidores
    $stmt->bindValue($i++, $limit,  PDO::PARAM_INT);
    $stmt->bindValue($i++, $offset, PDO::PARAM_INT);
    
    $stmt->execute();

    echo json_encode([
        'rows'        => $stmt->fetchAll(),
        'total'       => $total,
        'page'        => $page,
        'limit'       => $limit,
        'total_pages' => ceil($total / $limit)
    ]);
}

// ---- GET (single product with barcodes array) ----
function actionGet(PDO $db): void {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { jsonError('ID inválido.', 400); return; }

    $stmt = $db->prepare("
        SELECT p.id, p.cod_socofar, p.descripcion,
               GROUP_CONCAT(cb.cod_barra ORDER BY cb.id SEPARATOR '||') AS codigos_barra_raw
        FROM productos p
        LEFT JOIN codigos_barra cb ON cb.producto_id = p.id
        WHERE p.id = ?
        GROUP BY p.id
    ");
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    if (!$row) { jsonError('Producto no encontrado.', 404); return; }

    $barcodes = $row['codigos_barra_raw']
        ? array_values(array_filter(explode('||', $row['codigos_barra_raw'])))
        : [];

    echo json_encode([
        'ok'           => true,
        'id'           => (int)$row['id'],
        'cod_socofar'  => $row['cod_socofar'],
        'descripcion'  => $row['descripcion'],
        'codigos_barra'=> $barcodes,
    ]);
}

// ---- CREATE ----
function actionCreate(PDO $db): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonError('Método no permitido.', 405); return; }
    $body = jsonBody();

    $cod  = trim($body['cod_socofar'] ?? '');
    $desc = trim($body['descripcion'] ?? '');
    if (!$cod || !$desc) { jsonError('Código y descripción son obligatorios.'); return; }

    // Validamos que los códigos de barra no estén duplicados antes de iniciar la transacción.
    // Esto previene que insertemos datos inválidos y evita tener que revertir transacciones complejas.
    checkDuplicateBarcodes($db, 0, $body['codigos_barra'] ?? []);

    try {
        $db->beginTransaction();

        $stmt = $db->prepare("INSERT INTO productos (cod_socofar, descripcion) VALUES (?, ?)");
        $stmt->execute([$cod, $desc]);
        // Casteamos a entero porque lastInsertId() retorna string|false pero insertBarcodes requiere estrictamente un entero
        $productoId = (int) $db->lastInsertId();

        insertBarcodes($db, $productoId, $body['codigos_barra'] ?? []);

        $db->commit();
        echo json_encode(['ok' => true, 'id' => $productoId]);
    } catch (PDOException $e) {
        $db->rollBack();
        if ($e->getCode() === '23000') {
            jsonError('El código Socofar ya existe.');
        } else {
            jsonError('Error al crear el producto: ' . $e->getMessage());
        }
    }
}

// ---- UPDATE ----
function actionUpdate(PDO $db): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonError('Método no permitido.', 405); return; }
    $body = jsonBody();

    $id   = (int)($body['id'] ?? 0);
    $cod  = trim($body['cod_socofar'] ?? '');
    $desc = trim($body['descripcion'] ?? '');
    if (!$id || !$cod || !$desc) { jsonError('Datos incompletos.'); return; }

    // Validamos códigos de barra duplicados antes de alterar el producto existente.
    // Excluimos el producto actual de la validación para permitir mantener sus mismos códigos de barra.
    if (isset($body['codigos_barra'])) {
        checkDuplicateBarcodes($db, $id, $body['codigos_barra']);
    }

    try {
        $db->beginTransaction();

        $stmt = $db->prepare("UPDATE productos SET cod_socofar = ?, descripcion = ? WHERE id = ?");
        $stmt->execute([$cod, $desc, $id]);

        // Reemplazar códigos de barra si se enviaron
        if (isset($body['codigos_barra'])) {
            $db->prepare("DELETE FROM codigos_barra WHERE producto_id = ?")->execute([$id]);
            insertBarcodes($db, $id, $body['codigos_barra']);
        }

        $db->commit();
        echo json_encode(['ok' => true]);
    } catch (PDOException $e) {
        $db->rollBack();
        jsonError('Error al actualizar: ' . $e->getMessage());
    }
}

// ---- Helpers ----

// Comprueba si los códigos de barra ya están registrados en otro producto.
// Se ejecuta antes de las transacciones para agilizar la detección de conflictos
// y retornar detalles completos (nombre y código Socofar) del producto que ya usa el código.
function checkDuplicateBarcodes(PDO $db, int $productoId, array $barcodes): void {
    if (empty($barcodes)) {
        return;
    }

    $stmt = $db->prepare("
        SELECT cb.cod_barra, p.cod_socofar, p.descripcion 
        FROM codigos_barra cb
        INNER JOIN productos p ON cb.producto_id = p.id
        WHERE cb.cod_barra = ? AND cb.producto_id != ?
        LIMIT 1
    ");

    foreach ($barcodes as $cb) {
        $cb = trim((string)$cb);
        if ($cb === '') {
            continue;
        }
        $stmt->execute([$cb, $productoId]);
        $row = $stmt->fetch();
        if ($row) {
            jsonError("El código de barra {$cb} ya está asignado al producto {$row['descripcion']} (Socofar: {$row['cod_socofar']}).");
        }
    }
}
function insertBarcodes(PDO $db, int $productoId, array $barcodes): void {
    $stmt = $db->prepare("
        INSERT IGNORE INTO codigos_barra (producto_id, cod_barra)
        VALUES (?, ?)
    ");
    foreach ($barcodes as $cb) {
        $cb = trim((string)$cb);
        if ($cb !== '') $stmt->execute([$productoId, $cb]);
    }
}

function jsonBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function jsonError(string $msg, int $code = 422): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}
