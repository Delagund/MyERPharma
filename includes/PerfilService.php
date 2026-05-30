<?php
// ============================================================================
//  includes/PerfilService.php — Capa de Lógica de Negocio de Perfil (Agnóstica)
// ============================================================================

class PerfilService {
    private PerfilRepository $repository;

    public function __construct(PerfilRepository $repository) {
        $this->repository = $repository;
    }

    /**
     * Valida y ejecuta el cambio de contraseña de un usuario.
     * 
     * Se simplifica la firma a 3 argumentos. La validación del campo de confirmación
     * se delega a la capa de infraestructura del controlador. Se optimiza el rendimiento
     * criptográfico comparando las contraseñas nueva y actual directamente en memoria (===)
     * en lugar de computar un segundo hash costoso de bcrypt.
     * 
     * @throws InvalidArgumentException Si la nueva contraseña viola políticas de longitud.
     * @throws DomainException Si la contraseña actual es incorrecta o es idéntica a la nueva.
     * @throws RuntimeException Si la persistencia en base de datos falla.
     */
    public function cambiarContrasena(int $userId, string $passActual, string $passNueva): void {
        if ($userId <= 0) {
            throw new InvalidArgumentException('ID de usuario inválido.');
        }

        // 1. Validar política de seguridad de longitud (Negocio / Dominio)
        if (strlen($passNueva) < 8) {
            throw new InvalidArgumentException('La nueva contraseña debe tener al menos 8 caracteres.');
        }

        // 2. Validar que la nueva no sea idéntica a la actual (en memoria para evitar re-hash de bcrypt)
        if ($passNueva === $passActual) {
            throw new DomainException('La nueva contraseña no puede ser igual a la anterior.');
        }

        // 3. Verificar validez de la contraseña actual contra la base de datos
        $hashActual = $this->repository->obtenerHashContrasenaPorId($userId);
        if ($hashActual === null || !password_verify($passActual, $hashActual)) {
            throw new DomainException('La contraseña actual es incorrecta.');
        }

        // 4. Cifrar y persistir la nueva contraseña
        $nuevoHash = password_hash($passNueva, PASSWORD_BCRYPT, ['cost' => 12]);
        $exito = $this->repository->actualizarHashContrasena($userId, $nuevoHash);

        if (!$exito) {
            throw new RuntimeException('Error interno al actualizar la contraseña.');
        }
    }
}
