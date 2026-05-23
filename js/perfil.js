// ============================================================
//  js/perfil.js — Módulo Perfil (Cambio de Contraseña)
// ============================================================

function loadPerfil() {
    pageContent.innerHTML = `
        <div class="card card-form-container-sm">
            <div class="card-header">
                <span class="card-title">🔐 Cambio de Contraseña</span>
            </div>
            <div class="card-body">
                <p class="text-sm text-muted mb-6">
                    Para asegurar tu cuenta, ingresa tu contraseña actual y elige una nueva de al menos 8 caracteres.
                </p>

                <form id="perfil-form" novalidate>
                    <div class="form-group">
                        <label class="form-label" for="pass-actual">Contraseña Actual</label>
                        <div class="input-wrapper">
                            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            <input type="password" id="pass-actual" name="password_actual" class="form-input" placeholder="••••••••" required>
                            <button type="button" class="toggle-password" onclick="togglePasswordVisibility('pass-actual')">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="eye-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>
                            </button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="pass-nueva">Nueva Contraseña</label>
                        <div class="input-wrapper">
                            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="password" id="pass-nueva" name="nueva_password" class="form-input" placeholder="Mínimo 8 caracteres" required>
                            <button type="button" class="toggle-password" onclick="togglePasswordVisibility('pass-nueva')">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="eye-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>
                            </button>
                        </div>
                        <div class="password-strength-meter" id="strength-meter"></div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="pass-confirm">Confirmar Nueva Contraseña</label>
                        <div class="input-wrapper">
                            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M22 4L12 14.01l-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="password" id="pass-confirm" name="confirmacion" class="form-input" placeholder="Repite la nueva contraseña" required>
                        </div>
                    </div>

                    <div id="perfil-feedback"></div>

                    <button type="submit" class="btn btn-primary btn-full mt-4" id="perfil-submit">
                        Actualizar Contraseña
                    </button>
                </form>
            </div>
        </div>`;

    initPerfilForm();
}

function initPerfilForm() {
    const form       = document.getElementById('perfil-form');
    const passNueva  = document.getElementById('pass-nueva');
    const feedback   = document.getElementById('perfil-feedback');
    const meter      = document.getElementById('strength-meter');

    passNueva?.addEventListener('input', () => {
        const val = passNueva.value;
        let strength = 0;
        if (val.length >= 8) strength++;
        if (/[A-Z]/.test(val)) strength++;
        if (/[0-9]/.test(val)) strength++;
        if (/[^A-Za-z0-9]/.test(val)) strength++;

        meter.className = 'password-strength-meter strength-' + strength;
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('perfil-submit');
        const data = {
            password_actual: document.getElementById('pass-actual').value,
            nueva_password:  passNueva.value,
            confirmacion:    document.getElementById('pass-confirm').value
        };

        if (data.nueva_password.length < 8) {
            feedback.innerHTML = alertHTML('error', 'La nueva contraseña debe tener al menos 8 caracteres.');
            return;
        }

        if (data.nueva_password !== data.confirmacion) {
            feedback.innerHTML = alertHTML('error', 'Las contraseñas no coinciden.');
            return;
        }

        submitBtn.disabled = true;
        feedback.innerHTML = '<div class="text-center py-2"><svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#4f46e5" stroke-width="2" stroke-linecap="round"/></svg></div>';

        try {
            const res = await fetch('api/perfil.php?action=change_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.ok) {
                feedback.innerHTML = alertHTML('success', '✅ ' + result.message);
                form.reset();
                meter.className = 'password-strength-meter';
            } else {
                feedback.innerHTML = alertHTML('error', result.error || 'Ocurrió un error.');
            }
        } catch (err) {
            feedback.innerHTML = alertHTML('error', 'Error de conexión con el servidor.');
        } finally {
            submitBtn.disabled = false;
        }
    });
}

window.togglePasswordVisibility = function(id) {
    const input = document.getElementById(id);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
};
