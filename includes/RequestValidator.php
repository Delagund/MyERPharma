<?php
// ============================================================================
//  includes/RequestValidator.php — Validador Agnóstico de Inputs
// ============================================================================

class RequestValidator {
    /**
     * Valida un array de datos contra un conjunto de reglas.
     *
     * Reglas soportadas:
     *   - required: bool    El campo es obligatorio
     *   - min_length: int   Longitud mínima del campo
     *   - matches: string   El campo debe coincidir con otro campo
     *
     * @param array $data    Datos a validar (ej: $_POST, jsonBody)
     * @param array $rules   Definición de reglas por campo
     * @return string|null   Primer mensaje de error encontrado, o null si es válido
     */
    public static function validate(array $data, array $rules): ?string {
        foreach ($rules as $field => $fieldRules) {
            $value = $data[$field] ?? '';
            $label = $fieldRules['label'] ?? $field;

            if (!empty($fieldRules['required']) && trim((string)$value) === '') {
                return "El campo {$label} es obligatorio.";
            }

            if (!empty($fieldRules['min_length']) && strlen(trim((string)$value)) < $fieldRules['min_length']) {
                return "El campo {$label} debe tener al menos {$fieldRules['min_length']} caracteres.";
            }

            if (!empty($fieldRules['matches'])) {
                $otherField = $fieldRules['matches'];
                $otherValue = $data[$otherField] ?? '';
                if (trim((string)$value) !== trim((string)$otherValue)) {
                    $otherLabel = $rules[$otherField]['label'] ?? $otherField;
                    return "El campo {$label} no coincide con {$otherLabel}.";
                }
            }
        }

        return null;
    }

    /**
     * Valida y retorna errores de todos los campos (no solo el primero).
     *
     * @param array $data    Datos a validar
     * @param array $rules   Definición de reglas por campo
     * @return array         Lista vacía si es válido, o array de mensajes de error
     */
    public static function validateAll(array $data, array $rules): array {
        $errors = [];

        foreach ($rules as $field => $fieldRules) {
            $value = $data[$field] ?? '';
            $label = $fieldRules['label'] ?? $field;

            if (!empty($fieldRules['required']) && trim((string)$value) === '') {
                $errors[] = "El campo {$label} es obligatorio.";
                continue;
            }

            if (!empty($fieldRules['min_length']) && strlen(trim((string)$value)) < $fieldRules['min_length']) {
                $errors[] = "El campo {$label} debe tener al menos {$fieldRules['min_length']} caracteres.";
                continue;
            }

            if (!empty($fieldRules['matches'])) {
                $otherField = $fieldRules['matches'];
                $otherValue = $data[$otherField] ?? '';
                if (trim((string)$value) !== trim((string)$otherValue)) {
                    $otherLabel = $rules[$otherField]['label'] ?? $otherField;
                    $errors[] = "El campo {$label} no coincide con {$otherLabel}.";
                }
            }
        }

        return $errors;
    }
}
