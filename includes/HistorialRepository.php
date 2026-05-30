<?php
// ============================================================
//  includes/HistorialRepository.php
// ============================================================

class HistorialRepository {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Compila los filtros dinámicos compartidos para evitar la duplicación (DRY).
     */
    private function compilarFiltros(array $rawParams): array {
        $where = ['1=1'];
        $params = [];

        if (!empty($rawParams['q'])) {
            $like = "%" . trim($rawParams['q']) . "%";
            $where[] = "(p.cod_socofar LIKE ? OR p.descripcion LIKE ?)";
            $params[] = $like;
            $params[] = $like;
        }
        if (!empty($rawParams['tipo_movimiento_id'])) {
            $where[] = "hm.tipo_movimiento_id = ?";
            $params[] = (int)$rawParams['tipo_movimiento_id'];
        }
        if (!empty($rawParams['fecha_desde'])) {
            $where[] = "DATE(hm.fecha) >= ?";
            $params[] = trim($rawParams['fecha_desde']);
        }
        if (!empty($rawParams['fecha_hasta'])) {
            $where[] = "DATE(hm.fecha) <= ?";
            $params[] = trim($rawParams['fecha_hasta']);
        }

        return [
            'sql'   => implode(' AND ', $where),
            'binds' => $params
        ];
    }

    /**
     * Obtiene el listado de movimientos paginado.
     */
    public function obtenerListado(array $filtros, int $page, int $limit): array {
        $meta = $this->compilarFiltros($filtros);
        $offset = ($page - 1) * $limit;

        // Conteo total para la SPA
        $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM historial_movimientos hm INNER JOIN productos p ON p.id = hm.producto_id WHERE {$meta['sql']}");
        $stmtCount->execute($meta['binds']);
        $total = (int)$stmtCount->fetchColumn();

        // Consulta de datos relacionales
        $sql = "SELECT 
                    hm.id, hm.fecha, u.username AS usuario, tm.nombre AS tipo_movimiento, 
                    hm.tipo_movimiento_id, p.cod_socofar, p.descripcion AS producto, 
                    l.numero_lote, l.fecha_vencimiento, uo.codigo AS origen, 
                    ud.codigo AS destino, hm.cantidad 
                FROM historial_movimientos hm
                INNER JOIN usuarios u          ON u.id = hm.usuario_id
                INNER JOIN productos p         ON p.id = hm.producto_id
                INNER JOIN lotes l             ON l.id = hm.lote_id
                INNER JOIN ubicaciones uo      ON uo.id = hm.ubicacion_origen_id
                INNER JOIN ubicaciones ud      ON ud.id = hm.ubicacion_destino_id
                INNER JOIN tipo_movimiento tm ON tm.id = hm.tipo_movimiento_id
                WHERE {$meta['sql']} 
                ORDER BY hm.fecha DESC, hm.id DESC 
                LIMIT ? OFFSET ?";

        $stmtData = $this->db->prepare($sql);
        
        $index = 1;
        foreach ($meta['binds'] as $val) {
            $stmtData->bindValue($index++, $val);
        }
        $stmtData->bindValue($index++, $limit, PDO::PARAM_INT);
        $stmtData->bindValue($index++, $offset, PDO::PARAM_INT);
        $stmtData->execute();

        return [
            'rows'  => $stmtData->fetchAll(PDO::FETCH_ASSOC),
            'total' => $total
        ];
    }

    /**
     * Retorna un PDOStatement (cursor) optimizado para streaming de CSV sin saturar memoria.
     */
    public function obtenerCursorExportacion(array $filtros): \PDOStatement {
        $meta = $this->compilarFiltros($filtros);
        $sql = "SELECT 
                    hm.fecha, u.username AS usuario, tm.nombre AS tipo_movimiento, 
                    p.cod_socofar, p.descripcion AS producto, l.numero_lote, 
                    l.fecha_vencimiento, uo.codigo AS origen, ud.codigo AS destino, hm.cantidad 
                FROM historial_movimientos hm
                INNER JOIN usuarios u          ON u.id = hm.usuario_id
                INNER JOIN productos p         ON p.id = hm.producto_id
                INNER JOIN lotes l             ON l.id = hm.lote_id
                INNER JOIN ubicaciones uo      ON uo.id = hm.ubicacion_origen_id
                INNER JOIN ubicaciones ud      ON ud.id = hm.ubicacion_destino_id
                INNER JOIN tipo_movimiento tm ON tm.id = hm.tipo_movimiento_id
                WHERE {$meta['sql']} 
                ORDER BY hm.fecha DESC, hm.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($meta['binds']);
        return $stmt;
    }
}