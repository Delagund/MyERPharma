<?php
// ============================================================
//  api/ubicaciones.php — CRUD de Ubicaciones
//  Acciones: list | create | update | delete
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

header('Content-Type: application/json; charset=utf-8');

$db     = getDB();
$action = $_GET['action'] ?? '';

match ($action) {
    'list'   => actionList($db),
    'create' => actionCreate($db),
    'update' => actionUpdate($db),
    'delete' => actionDelete($db),
    default  => jsonError('Acción no reconocida.', 400),
};

// ---- LIST ----
function actionList(PDO $db): void {
    $q      = trim($_GET['q'] ?? '');
    $page   = max(1, (int)($_GET['page'] ?? 1));
    $limit  = 20; // Límite de 20 por página
    $offset = ($page - 1) * $limit;

    $whereSql = "1=1";
    $params = [];

    if ($q !== '') {
        $like = "%{$q}%";
        $whereSql = "(codigo LIKE ? OR descripcion LIKE ?)";
        $params = [$like, $like];
    }

    // Conteo total
    $countStmt = $db->prepare("SELECT COUNT(*) FROM ubicaciones WHERE $whereSql");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Consulta de datos
    $sql = "
        SELECT id, codigo, descripcion
        FROM ubicaciones
        WHERE $whereSql
        ORDER BY codigo
        LIMIT $limit OFFSET $offset
    ";
    
    // Preparar consulta de datos
    $stmt = $db->prepare($sql);
    
    // Bind de parámetros de búsqueda (strings)
    $i = 1;
    foreach ($params as $p) {
        $stmt->bindValue($i++, $p, PDO::PARAM_STR);
    }
    
    $stmt->execute();

    echo json_encode([
        'ok'          => true,
        'rows'        => $stmt->fetchAll(),
        'total'       => $total,
        'page'        => $page,
        'limit'       => $limit,
        'total_pages' => ceil($total / $limit)
    ]);
}

// ---- CREATE ----
function actionCreate(PDO $db): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonError('Método no permitido.', 405); return; }

    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $codigo = trim($body['codigo']      ?? '');
    $desc   = trim($body['descripcion'] ?? '');

    if ($codigo === '') { jsonError('El código de ubicación es obligatorio.'); return; }

    try {
        $db->prepare("INSERT INTO ubicaciones (codigo, descripcion) VALUES (?, ?)")
           ->execute([$codigo, $desc ?: null]);
        echo json_encode(['ok' => true, 'id' => (int) $db->lastInsertId()]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            jsonError("El código '{$codigo}' ya existe.");
        } else {
            jsonError('Error al guardar: ' . $e->getMessage());
        }
    }
}

// ---- UPDATE ----
function actionUpdate(PDO $db): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonError('Método no permitido.', 405); return; }

    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $id     = (int) ($body['id']           ?? 0);
    $codigo = trim($body['codigo']         ?? '');
    $desc   = trim($body['descripcion']    ?? '');

    if ($id <= 0)      { jsonError('ID inválido.');                            return; }
    if ($id === 1)     { jsonError('La ubicación EXTERIOR del sistema (ID 1) no puede ser modificada.', 403); return; }
    if ($codigo === '') { jsonError('El código de ubicación es obligatorio.'); return; }

    try {
        $stmt = $db->prepare("UPDATE ubicaciones SET codigo = ?, descripcion = ? WHERE id = ?");
        $stmt->execute([$codigo, $desc ?: null, $id]);
        if ($stmt->rowCount() === 0) {
            jsonError('Ubicación no encontrada.', 404);
        } else {
            echo json_encode(['ok' => true]);
        }
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            jsonError("El código '{$codigo}' ya existe.");
        } else {
            jsonError('Error al actualizar: ' . $e->getMessage());
        }
    }
}

// ---- DELETE ----
function actionDelete(PDO $db): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonError('Método no permitido.', 405); return; }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $id   = (int) ($body['id'] ?? 0);

    if ($id <= 0) { jsonError('ID inválido.'); return; }
    if ($id === 1) { jsonError('La ubicación EXTERIOR del sistema (ID 1) no puede ser eliminada.', 403); return; }

    // Verificar si la ubicación tiene stock asignado
    $check = $db->prepare("SELECT COUNT(*) FROM inventario WHERE ubicacion_id = ?");
    $check->execute([$id]);
    if ((int) $check->fetchColumn() > 0) {
        jsonError('No se puede eliminar: la ubicación tiene stock asignado. Mueve o retira el stock primero.');
        return;
    }

    $stmt = $db->prepare("DELETE FROM ubicaciones WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        jsonError('Ubicación no encontrada.', 404);
    } else {
        echo json_encode(['ok' => true]);
    }
}

function jsonError(string $msg, int $code = 422): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}
