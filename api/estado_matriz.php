<?php
// ============================================================
//  api/estado_matriz.php — Verifica antigüedad de matriz
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

header('Content-Type: application/json; charset=utf-8');

$db = getDB();

try {
    $stmt = $db->query("SELECT MAX(fecha_carga) AS ultima_carga FROM reglas_devolucion");
    $row = $stmt->fetch();
    
    $ultima_carga = $row['ultima_carga'];
    $alerta_activa = false;

    if (!$ultima_carga) {
        $alerta_activa = true;
    } else {
        $fechaCargaObj = new DateTime($ultima_carga);
        $fechaActualObj = new DateTime();
        
        // Si es de un mes distinto (ej. lo subió el 31 de Enero, y ahora es 1 de Feb) o tiene más de 30 días.
        if ($fechaCargaObj->format('Y-m') !== $fechaActualObj->format('Y-m')) {
            $alerta_activa = true;
        } else {
            $diff = $fechaActualObj->diff($fechaCargaObj);
            if ($diff->days > 30) {
                $alerta_activa = true;
            }
        }
    }

    echo json_encode([
        'ok' => true,
        'alerta_activa' => $alerta_activa,
        'ultima_carga' => $ultima_carga
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Error al consultar estado: ' . $e->getMessage()]);
}
