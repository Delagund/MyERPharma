-- Ejecutar una vez en cada base de la aplicación antes de desplegar el código.
-- No se aplica automáticamente ni forma parte de una suite de pruebas.
CREATE TABLE IF NOT EXISTS operaciones_idempotentes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    accion VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    operacion_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    respuesta_json MEDIUMTEXT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_operaciones_idempotentes_usuario_accion_id (usuario_id, accion, operacion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
