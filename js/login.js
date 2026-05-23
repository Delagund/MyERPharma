// ============================================================
//  MyErPharma — Login Page JS
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const form       = document.getElementById('login-form');
    const submitBtn  = document.getElementById('submit-btn');
    const btnText    = submitBtn?.querySelector('.btn-text');
    const btnLoading = submitBtn?.querySelector('.btn-loading');
    const toggleBtn  = document.getElementById('toggle-pwd');
    const pwdInput   = document.getElementById('password');

    // Toggle visibilidad contraseña
    if (toggleBtn && pwdInput) {
        toggleBtn.addEventListener('click', () => {
            const isText = pwdInput.type === 'text';
            pwdInput.type = isText ? 'password' : 'text';
            toggleBtn.setAttribute('aria-label', isText ? 'Mostrar contraseña' : 'Ocultar contraseña');
        });
    }

    // Estado de carga al enviar
    if (form) {
        form.addEventListener('submit', () => {
            if (btnText)    btnText.hidden    = true;
            if (btnLoading) btnLoading.hidden = false;
            if (submitBtn)  submitBtn.disabled = true;
        });
    }

    // Auto-foco al primer campo
    document.getElementById('username')?.focus();
});
