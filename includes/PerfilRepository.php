<?php
// ============================================================================
//  includes/PerfilRepository.php — Capa de Persistencia para Perfil / Usuario
// ============================================================================

class PerfilRepository {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Obtiene el hash de la contraseña actual de un usuario por su ID.
     * 
     * Se limita la consulta a 1 elemento ya que el ID es llave primaria.
     * Retorna null si el usuario no existe en la base de datos.
     */
    public function obtenerHashContrasenaPorId(int $userId): ?string {
        $stmt = $this->db->prepare("SELECT password_hash FROM usuarios WHERE id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $res = $stmt->fetch(PDO::FETCH_ASSOC);
        return $res ? $res['password_hash'] : null;
    }

    /**
     * Actualiza el hash de la contraseña de un usuario específico.
     * 
     * Retorna true si la consulta se ejecutó de forma correcta.
     */
    public function actualizarHashContrasena(int $userId, string $nuevoHash): bool {
        $stmt = $this->db->prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?");
        return $stmt->execute([$nuevoHash, $userId]);
    }
}
