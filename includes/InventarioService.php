<?php
// ============================================================================
//  includes/InventarioService.php — Capa de Lógica de Negocio Pura (Agnóstica)
// ============================================================================

class InventarioService {
    private InventarioRepository $repository;

    public function __construct(InventarioRepository $repository) {
        $this->repository = $repository;
    }

    /**
     * Ejecuta la lógica transaccional de un traslado interno entre ubicaciones.
     * Aplana las ramificaciones lógicas reduciendo drásticamente el NPath.
     */
    public function ejecutarTraslado(int $inventarioId, int $ubicacionDestinoId, int $cantidad, int $usuarioId): array {
        // Cláusulas de Salvaguarda Iniciales (Validaciones de Parámetros)
        if ($inventarioId <= 0)        { throw new InvalidArgumentException('Registro de inventario origen inválido.'); }
        if ($ubicacionDestinoId <= 0) { throw new InvalidArgumentException('Ubicación de destino requerida.'); }
        if ($cantidad < 1)             { throw new InvalidArgumentException('La cantidad debe ser mayor a 0.'); }
        
        if ($ubicacionDestinoId === 1) {
            throw new DomainException('No se puede trasladar stock a la ubicación EXTERIOR del sistema. Para retirar stock, realice una Salida.');
        }

        try {
            $this->repository->iniciarTransaccion();

            // Obtener y bloquear el origen de forma atómica en InnoDB
            $origen = $this->repository->buscarInventarioParaModificar($inventarioId);
            if (!$origen) {
                throw new DomainException('El registro de inventario origen no existe.');
            }

            // Validaciones de Estado de Negocio
            if ((int)$origen['ubicacion_id'] === 1) {
                throw new DomainException('No se puede realizar traslados desde la ubicación EXTERIOR del sistema.');
            }
            if ((int)$origen['ubicacion_id'] === $ubicacionDestinoId) {
                throw new DomainException('La ubicación de destino debe ser diferente a la de origen.');
            }
            if ($cantidad > (int)$origen['cantidad']) {
                throw new DomainException("Stock insuficiente en origen. Disponible: {$origen['cantidad']} unidades.");
            }

            // Validar existencia de la ubicación destino en el maestro
            if (!$this->repository->existeUbicacion($ubicacionDestinoId)) {
                throw new DomainException('La ubicación de destino no existe.');
            }

            // Ejecución de Persistencia (Fisión de subprocesos)
            $nuevoStockOrigen  = $this->repository->descontarStockOrigen($inventarioId, (int)$origen['cantidad'], $cantidad);
            $nuevoStockDestino = $this->repository->incrementarStockDestino((int)$origen['lote_id'], $ubicacionDestinoId, $cantidad);

            // Registro en Kardex Relacional (Tipo Movimiento: 3 - Traspaso)
            $this->repository->registrarHistorial($usuarioId, (int)$origen['producto_id'], (int)$origen['lote_id'], (int)$origen['ubicacion_id'], $ubicacionDestinoId, 3, $cantidad);

            $this->repository->confirmarTransaccion();

            // Retornar datos limpios para el contrato estructurado de salida
            return [
                'nuevo_stock_origen'  => $nuevoStockOrigen,
                'nuevo_stock_destino' => $nuevoStockDestino,
                'lote_id'             => (int)$origen['lote_id'],
                'producto_id'         => (int)$origen['producto_id'],
                'ubicacion_origen_id' => (int)$origen['ubicacion_id']
            ];

        } catch (Exception $e) {
            $this->repository->revertirTransaccion();
            throw $e; // Re-lanzar para que el Controller de la API lo capture
        }
    }

    /**
     * Procesa la lógica de negocio y persistencia para la entrada de stock de un lote.
     * Reduce la complejidad combinatoria (NPath) aislando las bifurcaciones.
     */
    public function ejecutarEntrada(int $productoId, string $numeroLote, string $fechaVencimiento, int $ubicacionId, int $cantidad, int $usuarioId): array {
        // 1. Cláusulas de Salvaguarda (Validaciones de Entrada)
        if ($productoId <= 0)     { throw new InvalidArgumentException('Producto inválido.'); }
        if ($numeroLote === '')   { throw new InvalidArgumentException('Número de lote requerido.'); }
        if ($fechaVencimiento === '') { throw new InvalidArgumentException('Fecha de vencimiento requerida.'); }
        if ($ubicacionId <= 0)    { throw new InvalidArgumentException('Ubicación requerida.'); }
        if ($cantidad < 1)         { throw new InvalidArgumentException('La cantidad debe ser mayor a 0.'); }
        
        if ($ubicacionId === 1) {
            throw new DomainException('No se puede almacenar stock directamente en la ubicación EXTERIOR del sistema.');
        }

        $fechaObj = DateTime::createFromFormat('Y-m-d', $fechaVencimiento);
        if (!$fechaObj) { 
            throw new InvalidArgumentException('Formato de fecha inválido. Use YYYY-MM-DD.'); 
        }

        try {
            $this->repository->iniciarTransaccion();

            // 2. Gestionar la existencia del Lote
            $lote = $this->repository->buscarLote($productoId, $numeroLote);
            if ($lote) {
                $loteId = (int)$lote['id'];
                $this->repository->actualizarFechaVencimientoLote($loteId, $fechaVencimiento);
            } else {
                $loteId = $this->repository->crearLote($productoId, $numeroLote, $fechaVencimiento);
            }

            // 3. Gestionar la existencia del Inventario Físico
            $inv = $this->repository->buscarInventarioPorLoteYUbicacion($loteId, $ubicacionId);
            if ($inv) {
                $this->repository->sumarStockInventario((int)$inv['id'], $cantidad);
                $nuevoStock = (int)$inv['cantidad'] + $cantidad;
            } else {
                $this->repository->crearInventarioInicial($loteId, $ubicacionId, $cantidad);
                $nuevoStock = $cantidad;
            }

            // 4. Registro en Kardex Relacional (Tipo Movimiento: 1 - Entrada, Origen Ficticio: 1)
            $this->repository->registrarHistorial($usuarioId, $productoId, $loteId, 1, $ubicacionId, 1, $cantidad);

            $this->repository->confirmarTransaccion();

            return [
                'nuevo_stock' => $nuevoStock,
                'lote_id'     => $loteId
            ];

        } catch (Exception $e) {
            $this->repository->revertirTransaccion();
            throw $e;
        }
    }

    /**
     * Ejecuta la salida múltiple de stock de un producto desde varias ubicaciones/lotes.
     *
     * @param int $productoId
     * @param array<int, mixed> $operaciones
     * @param int $usuarioId
     * @return array{producto_id: int, resultados: array<int, array{inventario_id: int, lote_id: int, ubicacion_origen_id: int, cantidad: int, nuevo_stock: int, eliminado: bool}>}
     */
    public function ejecutarSalidaMultiple(int $productoId, array $operaciones, int $usuarioId): array {
        if ($productoId <= 0) {
            throw new InvalidArgumentException('Producto inválido.');
        }

        if (empty($operaciones)) {
            throw new InvalidArgumentException('Debe especificar al menos una operación de salida.');
        }

        foreach ($operaciones as $op) {
            if (!is_array($op) || ((int)($op['inventario_id'] ?? 0)) <= 0) {
                throw new InvalidArgumentException('ID de inventario inválido.');
            }
            if (((int)($op['cantidad'] ?? 0)) < 1) {
                throw new InvalidArgumentException('La cantidad debe ser mayor a 0.');
            }
        }

        try {
            $this->repository->iniciarTransaccion();

            $existeProducto = $this->repository->bloquearProducto($productoId);
            if (!$existeProducto) {
                throw new DomainException('El producto especificado no existe.');
            }

            $resultados = [];

            foreach ($operaciones as $op) {
                $invId = (int)$op['inventario_id'];
                $cantidad = (int)$op['cantidad'];

                $inv = $this->repository->buscarInventarioParaModificar($invId);
                if (!$inv) {
                    throw new DomainException("El registro de inventario ID {$invId} no existe.");
                }

                if ((int)$inv['producto_id'] !== $productoId) {
                    throw new DomainException("El inventario ID {$invId} no pertenece al producto seleccionado.");
                }

                if ((int)$inv['ubicacion_id'] === 1) {
                    throw new DomainException("No se puede realizar salidas desde la ubicación EXTERIOR del sistema.");
                }

                if ($cantidad > (int)$inv['cantidad']) {
                    throw new DomainException("Stock insuficiente en el inventario ID {$invId}. Disponible: {$inv['cantidad']} unidades.");
                }

                $nuevoStock = $this->repository->descontarStockOrigen($invId, (int)$inv['cantidad'], $cantidad);
                $this->repository->registrarHistorial($usuarioId, $productoId, (int)$inv['lote_id'], (int)$inv['ubicacion_id'], 1, 2, $cantidad);

                $resultados[] = [
                    'inventario_id'        => $invId,
                    'lote_id'             => (int)$inv['lote_id'],
                    'ubicacion_origen_id' => (int)$inv['ubicacion_id'],
                    'cantidad'            => $cantidad,
                    'nuevo_stock'         => $nuevoStock,
                    'eliminado'           => ($nuevoStock === 0),
                ];
            }

            $this->repository->confirmarTransaccion();

            return [
                'producto_id' => $productoId,
                'resultados'  => $resultados
            ];

        } catch (Exception $e) {
            $this->repository->revertirTransaccion();
            throw $e;
        }
    }
}