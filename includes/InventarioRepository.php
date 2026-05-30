<?php
// ============================================================================
//  includes/InventarioRepository.php — Capa de Persistencia Relacional (InnoDB)
// ============================================================================

class InventarioRepository {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function iniciarTransaccion(): void {
        $this->db->beginTransaction();
    }

    public function confirmarTransaccion(): void {
        $this->db->commit();
    }

    public function revertirTransaccion(): void {
        if ($this->db->inTransaction()) {
            $this->db->rollBack();
        }
    }

    /**
     * Obtiene y bloquea de forma atómica un registro de inventario origen.
     */
    public function buscarInventarioParaModificar(int $inventarioId): ?array {
        $stmt = $this->db->prepare("
            SELECT i.lote_id, i.ubicacion_id, i.cantidad, l.producto_id 
            FROM inventario i 
            INNER JOIN lotes l ON l.id = i.lote_id
            WHERE i.id = ? 
            FOR UPDATE
        ");
        $stmt->execute([$inventarioId]);
        $res = $stmt->fetch(PDO::FETCH_ASSOC);
        return $res ?: null;
    }

    /**
     * Verifica la existencia física de una ubicación en el maestro.
     */
    public function existeUbicacion(int $ubicacionId): bool {
        $stmt = $this->db->prepare("SELECT id FROM ubicaciones WHERE id = ?");
        $stmt->execute([$ubicacionId]);
        return (bool)$stmt->fetch();
    }

    /**
     * Descuenta stock de una ubicación (origen). Elimina si llega a 0.
     */
    public function descontarStockOrigen(int $inventarioId, int $cantidadActual, int $cantidadARetirar): int {
        $nuevoStock = $cantidadActual - $cantidadARetirar;
        if ($nuevoStock === 0) {
            $stmt = $this->db->prepare("DELETE FROM inventario WHERE id = ?");
            $stmt->execute([$inventarioId]);
        } else {
            $stmt = $this->db->prepare("UPDATE inventario SET cantidad = ? WHERE id = ?");
            $stmt->execute([$nuevoStock, $inventarioId]);
        }
        return $nuevoStock;
    }

    /**
     * Incrementa o crea stock de un lote en una ubicación de destino.
     */
    public function incrementarStockDestino(int $loteId, int $ubicacionDestinoId, int $cantidad): int {
        $stmt = $this->db->prepare("SELECT id, cantidad FROM inventario WHERE lote_id = ? AND ubicacion_id = ? FOR UPDATE");
        $stmt->execute([$loteId, $ubicacionDestinoId]);
        $dest = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($dest) {
            $stmt = $this->db->prepare("UPDATE inventario SET cantidad = cantidad + ? WHERE id = ?");
            $stmt->execute([$cantidad, $dest['id']]);
            return (int)$dest['cantidad'] + $cantidad;
        } else {
            $stmt = $this->db->prepare("INSERT INTO inventario (lote_id, ubicacion_id, cantidad) VALUES (?, ?, ?)");
            $stmt->execute([$loteId, $ubicacionDestinoId, $cantidad]);
            return $cantidad;
        }
    }

    /**
     * Registra de forma histórica el movimiento en el Kardex relacional.
     */
    public function registrarHistorial(int $usuarioId, int $productoId, int $loteId, int $origenId, int $destinoId, int $tipoMovimientoId, int $cantidad): void {
        $stmt = $this->db->prepare("
            INSERT INTO historial_movimientos (usuario_id, producto_id, lote_id, ubicacion_origen_id, ubicacion_destino_id, tipo_movimiento_id, cantidad)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$usuarioId, $productoId, $loteId, $origenId, $destinoId, $tipoMovimientoId, $cantidad]);
    }

    /**
     * Busca un lote específico por producto y número de lote.
     */
    public function buscarLote(int $productoId, string $numeroLote): ?array {
        $stmt = $this->db->prepare("SELECT id FROM lotes WHERE producto_id = ? AND numero_lote = ?");
        $stmt->execute([$productoId, $numeroLote]);
        $res = $stmt->fetch(PDO::FETCH_ASSOC);
        return $res ?: null;
    }

    /**
     * Actualiza la fecha de vencimiento de un lote existente.
     */
    public function actualizarFechaVencimientoLote(int $loteId, string $fechaVencimiento): void {
        $stmt = $this->db->prepare("UPDATE lotes SET fecha_vencimiento = ? WHERE id = ?");
        $stmt->execute([$fechaVencimiento, $loteId]);
    }

    /**
     * Crea un nuevo lote y retorna su ID.
     */
    public function crearLote(int $productoId, string $numeroLote, string $fechaVencimiento): int {
        $stmt = $this->db->prepare("
            INSERT INTO lotes (producto_id, numero_lote, fecha_vencimiento)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$productoId, $numeroLote, $fechaVencimiento]);
        return (int)$this->db->lastInsertId();
    }

    /**
     * Busca el registro de inventario asignado a un lote y ubicación.
     */
    public function buscarInventarioPorLoteYUbicacion(int $loteId, int $ubicacionId): ?array {
        $stmt = $this->db->prepare("SELECT id, cantidad FROM inventario WHERE lote_id = ? AND ubicacion_id = ?");
        $stmt->execute([$loteId, $ubicacionId]);
        $res = $stmt->fetch(PDO::FETCH_ASSOC);
        return $res ?: null;
    }

    /**
     * Incrementa la cantidad de stock en un registro de inventario específico.
     */
    public function sumarStockInventario(int $inventarioId, int $cantidad): void {
        $stmt = $this->db->prepare("UPDATE inventario SET cantidad = cantidad + ? WHERE id = ?");
        $stmt->execute([$cantidad, $inventarioId]);
    }

    /**
     * Crea un registro de inventario inicial para un lote y ubicación.
     */
    public function crearInventarioInicial(int $loteId, int $ubicacionId, int $cantidad): void {
        $stmt = $this->db->prepare("
            INSERT INTO inventario (lote_id, ubicacion_id, cantidad)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$loteId, $ubicacionId, $cantidad]);
    }
}