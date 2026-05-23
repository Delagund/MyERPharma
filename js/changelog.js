// ============================================================
//  js/changelog.js — Módulo de Notas de Versión y Changelog
// ============================================================

async function loadChangelog() {
    const isAdmin = (APP_USER.role === 'admin');

    pageContent.innerHTML = `
        ${isAdmin ? `
        <div class="card mb-6">
            <div class="card-header">
                <span class="card-title">🛠️ Panel de Administración: Sistema y Notas de Versión</span>
            </div>
            <div class="card-body flex flex-col gap-6">
                <!-- Sección 1: Subida de release_note.json -->
                <div>
                    <h4 class="font-semibold text-sm mb-1 text-primary">Actualizar Historial de Versiones (.json)</h4>
                    <p class="text-xs text-secondary mb-4">
                        Sube un nuevo archivo <code>release_note.json</code> para actualizar el historial de cambios en el sistema.
                    </p>
                    <form id="form-upload-changelog" class="flex-row-wrap flex-items-center gap-4">
                        <div class="form-group mb-0 flex-1 file-input-wrapper">
                            <div class="input-wrapper">
                                <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <input type="file" id="changelog-file-input" accept=".json" class="form-input">
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-action" id="btn-upload-changelog">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Subir Notas (.json)
                        </button>
                    </form>
                    <div id="changelog-upload-feedback" class="mt-3"></div>
                </div>

                <hr class="divider">

                <!-- Sección 2: Actualización de Número de Versión -->
                <div>
                    <h4 class="font-semibold text-sm mb-1 text-primary">Actualizar Número de Versión Principal</h4>
                    <p class="text-xs text-secondary mb-4">
                        Modifica directamente la versión activa del sistema que se muestra en la barra lateral y en el inicio de sesión.
                    </p>
                    <form id="form-update-version" class="flex-row-wrap flex-items-center gap-4">
                        <div class="form-group mb-0 flex-1 file-input-wrapper">
                            <div class="input-wrapper">
                                <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <input type="text" id="system-version-input" class="form-input" placeholder="Ej. 2.3.0" value="${escapeHtml(typeof APP_VERSION !== 'undefined' ? APP_VERSION : '2.3.0')}" required pattern="^\\d+\\.\\d+\\.\\d+$" title="El formato debe ser X.Y.Z (ej. 1.0.0)">
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-action" id="btn-update-version">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Guardar Versión
                        </button>
                    </form>
                    <div id="version-update-feedback" class="mt-3"></div>
                </div>
            </div>
        </div>
        ` : ''}

        <div class="card">
            <div class="card-header card-header-bordered">
                <h3 class="font-semibold text-lg text-primary">Línea de Tiempo de Versiones</h3>
                <p class="text-xs text-secondary">Historial oficial de actualizaciones y mejoras en MyERPharma</p>
            </div>
            <div id="changelog-timeline-container" class="changelog-timeline">
                <div class="loading-spinner p-8">Cargando timeline...</div>
            </div>
        </div>
    `;

    const timelineContainer = document.getElementById('changelog-timeline-container');

    async function fetchChangelog() {
        if (!timelineContainer) return;
        timelineContainer.innerHTML = '<div class="loading-spinner p-8">Cargando notas de versión...</div>';

        try {
            const res = await fetch('assets/release_note.json?t=' + Date.now());
            if (!res.ok) {
                throw new Error("No se pudo cargar el archivo de notas de versión.");
            }
            const data = await res.json();

            if (!data || data.length === 0) {
                timelineContainer.innerHTML = '<div class="text-center text-muted p-8">No hay notas de versión registradas.</div>';
                return;
            }

            timelineContainer.innerHTML = data.map(v => `
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-header">
                        <span class="timeline-version">Versión ${escapeHtml(v.version)}</span>
                        <span class="timeline-date">${escapeHtml(formatDate(v.fecha))}</span>
                    </div>
                    <div class="timeline-title">${escapeHtml(v.titulo)}</div>
                    <div class="timeline-desc">${escapeHtml(v.descripcion)}</div>
                    
                    ${v.secciones && v.secciones.length > 0 ? v.secciones.map(sec => `
                        <div class="timeline-change-group">
                            <div class="timeline-category">${escapeHtml(sec.categoria)}</div>
                            <ul class="timeline-items-list">
                                ${sec.items && sec.items.length > 0 ? sec.items.map(item => `
                                    <li>${parseMarkdownStyles(item)}</li>
                                `).join('') : '<li>Sin cambios reportados.</li>'}
                            </ul>
                        </div>
                    `).join('') : ''}
                </div>
            `).join('');

        } catch (e) {
            timelineContainer.innerHTML = `
                <div class="text-center text-danger p-8">
                    Error al cargar las notas de versión: ${escapeHtml(e.message || e)}
                    <br><button class="btn btn-outline btn-xs mt-3" id="btn-retry-changelog">Reintentar</button>
                </div>`;
            document.getElementById('btn-retry-changelog')?.addEventListener('click', fetchChangelog);
        }
    }

    function parseMarkdownStyles(text) {
        let html = escapeHtml(text);
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');
        return html;
    }

    if (isAdmin) {
        const form = document.getElementById('form-upload-changelog');
        const fileInput = document.getElementById('changelog-file-input');
        const feedback = document.getElementById('changelog-upload-feedback');
        const submitBtn = document.getElementById('btn-upload-changelog');

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                showToast('Por favor selecciona un archivo .json válido.', 'warning');
                return;
            }

            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append('archivo', file);

            if (feedback) {
                feedback.innerHTML = '<span class="text-muted">Subiendo y validando archivo...</span>';
            }
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Subiendo...';
            }

            try {
                const res = await fetch('api/changelog_upload.php', {
                    method: 'POST',
                    body: formData
                });
                const resData = await res.json();

                if (resData.ok) {
                    showToast('Notas de versión actualizadas correctamente.', 'success');
                    if (feedback) {
                        feedback.innerHTML = `<span class="text-success">${escapeHtml(resData.mensaje)}</span>`;
                    }
                    fileInput.value = '';
                    fetchChangelog();
                } else {
                    showToast(resData.error || 'Error al subir el archivo.', 'error');
                    if (feedback) {
                        feedback.innerHTML = `<span class="text-danger">Error: ${escapeHtml(resData.error)}</span>`;
                    }
                }
            } catch (err) {
                showToast('Error de conexión al subir el archivo.', 'error');
                if (feedback) {
                    feedback.innerHTML = '<span class="text-danger">Error de red al conectar con el servidor.</span>';
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Subir Notas (.json)';
                }
            }
        });

        const versionForm = document.getElementById('form-update-version');
        const versionInput = document.getElementById('system-version-input');
        const versionFeedback = document.getElementById('version-update-feedback');
        const versionBtn = document.getElementById('btn-update-version');

        versionForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newVersion = versionInput?.value.trim();
            if (!newVersion) {
                showToast('Por favor ingresa un número de versión válido.', 'warning');
                return;
            }

            if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
                showToast('Formato inválido. Debe ser X.Y.Z (ej. 1.0.0).', 'error');
                return;
            }

            if (versionFeedback) {
                versionFeedback.innerHTML = '<span class="text-muted">Actualizando versión...</span>';
            }
            if (versionBtn) {
                versionBtn.disabled = true;
                versionBtn.innerHTML = 'Guardando...';
            }

            try {
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

                const res = await fetch('api/update_version.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken || ''
                    },
                    body: JSON.stringify({ version: newVersion })
                });
                const resData = await res.json();

                if (resData.ok) {
                    showToast('Versión del sistema actualizada.', 'success');
                    if (versionFeedback) {
                        versionFeedback.innerHTML = `<span class="text-success">${escapeHtml(resData.mensaje)}</span>`;
                    }
                    
                    document.querySelectorAll('.sidebar-version').forEach(el => {
                        el.textContent = 'v' + newVersion;
                    });
                    
                    window.APP_VERSION = newVersion;
                } else {
                    showToast(resData.error || 'Error al actualizar versión.', 'error');
                    if (versionFeedback) {
                        versionFeedback.innerHTML = `<span class="text-danger">Error: ${escapeHtml(resData.error)}</span>`;
                    }
                }
            } catch (err) {
                showToast('Error de conexión al actualizar versión.', 'error');
                if (versionFeedback) {
                    versionFeedback.innerHTML = '<span class="text-danger">Error de red al conectar con el servidor.</span>';
                }
            } finally {
                if (versionBtn) {
                    versionBtn.disabled = false;
                    versionBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Guardar Versión
                    `;
                }
            }
        });
    }

    fetchChangelog();
}
