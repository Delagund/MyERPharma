// ============================================================
//  js/logistica.js — Módulo de Logística Inversa
// ============================================================

async function loadLogistica() {
    showLoading();

    pageContent.innerHTML = `
        <div class="card mb-6">
            <div class="card-header">
                <span class="card-title">🔄 Actualizar Matriz de Canjes</span>
            </div>
            <div class="card-body">
                <div id="matriz-estado-info" class="text-sm mb-4">
                    <span class="text-muted">Última actualización:</span> <strong id="fecha-ultima-carga">Cargando...</strong>
                </div>
                
                <form id="form-upload-canjes" class="flex gap-3 flex-row-wrap flex-items-center">
                    <div class="form-group mb-0 flex-1 file-input-wrapper">
                        <input type="file" id="archivo-csv" accept=".csv" class="form-input" required>
                    </div>
                    <button type="submit" class="btn btn-primary" id="btn-upload-canjes">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Subir CSV
                    </button>
                </form>
                <div id="upload-feedback" class="mt-3"></div>
            </div>
        </div>

        <div class="card mb-6">
            <div class="card-header">
                <span class="card-title">🔍 Consulta de Política por Producto</span>
            </div>
            <div class="card-body">
                <div class="form-group mb-4 file-input-wrapper">
                    <input type="text" id="busqueda-regla" class="form-input" placeholder="Buscar por Código, Barras o Descripción..." oninput="debounceBusquedaRegla()">
                </div>
                <div class="table-wrapper">
                    <table class="data-table" id="logistica-reglas-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Código Barras</th>
                                <th>Producto</th>
                                <th>¿Aplica Canje?</th>
                                <th>Mes a Devolver</th>
                            </tr>
                        </thead>
                        <tbody id="reglas-tbody">
                            <tr><td colspan="5" class="text-center text-muted p-6">Escriba al menos 2 caracteres para buscar...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">📊 Reporte de Vencimientos y Canjes</span>
                <div class="flex gap-2">
                    <button class="btn btn-sm btn-secondary" onclick="loadTablaCanjes()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Actualizar
                    </button>
                    <a href="api/reportes_canjes.php?export=1" class="btn btn-sm btn-primary btn-action">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Exportar CSV
                    </a>
                </div>
            </div>
            <div class="table-wrapper">
                <table class="data-table" id="logistica-canjes-table">
                    <thead>
                        <tr>
                            <th>Ubicación</th>
                            <th>Código</th>
                            <th>Producto</th>
                            <th>Lote</th>
                            <th>Vencimiento Lote</th>
                            <th>Tipo de Alerta</th>
                            <th>Cantidad</th>
                        </tr>
                    </thead>
                    <tbody id="canjes-tbody">
                        <tr><td colspan="7" class="text-center p-8">Cargando reporte...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    await loadEstadoMatriz();
    await loadTablaCanjes();
    initUploadForm();
}

async function loadEstadoMatriz() {
    try {
        const res = await fetch('api/estado_matriz.php');
        const data = await res.json();
        const info = document.getElementById('fecha-ultima-carga');
        if (info) {
            if (data.ultima_carga) {
                info.textContent = formatDate(data.ultima_carga.split(' ')[0]) + ' ' + data.ultima_carga.split(' ')[1];
                if (data.alerta_activa) {
                    info.style.color = 'var(--danger)';
                    info.textContent += ' (Desactualizada)';
                } else {
                    info.style.color = 'var(--success)';
                }
            } else {
                info.textContent = 'Nunca';
            }
        }
    } catch (e) {
        // silence
    }
}

async function loadTablaCanjes() {
    const tbody = document.getElementById('canjes-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner p-8">Cargando...</div></td></tr>';
    
    try {
        const res = await fetch('api/reportes_canjes.php');
        const data = await res.json();
        
        if (data.ok) {
            if (data.rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">✅ Todo en orden. No hay lotes próximos a vencer ni canjes habilitados.</div></td></tr>';
            } else {
                tbody.innerHTML = data.rows.map(r => {
                    let badgeClass = 'neutral';
                    if (r.tipo_alerta === 'Canje habilitado') badgeClass = 'success';
                    else if (r.tipo_alerta === 'Sin canje (Baja)') badgeClass = 'danger';
                    else badgeClass = 'warning';

                    return `
                        <tr>
                            <td data-label="Ubicación">${escapeHtml(r.ubicacion ?? '—')}</td>
                            <td data-label="Código"><span class="badge badge-info">${escapeHtml(r.cod_socofar)}</span></td>
                            <td data-label="Producto" class="col-producto" title="${escapeHtml(r.descripcion)}">${escapeHtml(r.descripcion)}</td>
                            <td data-label="Lote">${escapeHtml(r.numero_lote)}</td>
                            <td data-label="Vencimiento Lote"><span class="badge badge-${expiryBadgeClass(r.fecha_vencimiento)}">${formatDate(r.fecha_vencimiento)}</span></td>
                            <td data-label="Tipo de Alerta"><span class="badge badge-${badgeClass}">${escapeHtml(r.tipo_alerta)}</span></td>
                            <td data-label="Cantidad"><strong>${r.cantidad}</strong></td>
                        </tr>
                    `;
                }).join('');
            }
        } else {
            tbody.innerHTML = `<tr><td colspan="7">${alertHTML('error', data.error)}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7">${alertHTML('error', 'Error al cargar el reporte.')}</td></tr>`;
    }
}

function initUploadForm() {
    const form = document.getElementById('form-upload-canjes');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('archivo-csv');
        const feedback = document.getElementById('upload-feedback');
        const btn = document.getElementById('btn-upload-canjes');

        if (!fileInput.files.length) {
            feedback.innerHTML = alertHTML('error', 'Por favor, selecciona un archivo CSV.');
            return;
        }

        const formData = new FormData();
        formData.append('archivo', fileInput.files[0]);

        btn.disabled = true;
        btn.innerHTML = '<svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Procesando...';
        feedback.innerHTML = '';

        try {
            const res = await fetch('api/canjes_upload.php', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (res.ok && data.ok) {
                let msg = data.mensaje;
                if (data.fallos_fecha > 0) {
                    msg += ` (Atención: Hubo ${data.fallos_fecha} registros con formato de fecha inválido que se guardaron sin fecha límite).`;
                    feedback.innerHTML = alertHTML('warning', msg);
                } else {
                    feedback.innerHTML = alertHTML('success', msg);
                }
                form.reset();
                await loadEstadoMatriz();
                await loadTablaCanjes();
            } else {
                feedback.innerHTML = alertHTML('error', data.error || 'Error desconocido al subir el archivo.');
            }
        } catch (e) {
            feedback.innerHTML = alertHTML('error', 'Error de conexión con el servidor.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Subir CSV`;
        }
    });
}

let busquedaReglaTimeout = null;

function debounceBusquedaRegla() {
    clearTimeout(busquedaReglaTimeout);
    busquedaReglaTimeout = setTimeout(buscarReglas, 400);
}

async function buscarReglas() {
    const q = document.getElementById('busqueda-regla').value.trim();
    const tbody = document.getElementById('reglas-tbody');
    
    if (q.length < 2) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-6">Escriba al menos 2 caracteres para buscar...</td></tr>';
        return;
    }

    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="loading-spinner p-4">Buscando...</div></td></tr>';

    try {
        const res = await fetch(`api/consulta_reglas.php?q=${encodeURIComponent(q)}`);
        const data = await res.json();

        if (data.ok) {
            if (data.rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-6">No se encontraron productos coincidentes.</td></tr>';
                return;
            }

            tbody.innerHTML = data.rows.map(r => {
                let badgeCanje = r.tiene_canje == 1 
                    ? '<span class="badge badge-success">SÍ</span>' 
                    : '<span class="badge badge-danger">NO</span>';
                
                let mesDevolver = r.mes_vencimiento_devolver 
                    ? `<span class="badge badge-info">${formatDate(r.mes_vencimiento_devolver)}</span>` 
                    : '<span class="text-muted">—</span>';

                return `
                    <tr>
                        <td data-label="Código"><strong>${escapeHtml(r.cod_socofar)}</strong></td>
                        <td data-label="Código Barras"><span class="text-muted text-sm">${escapeHtml(r.codigo_barras || '—')}</span></td>
                        <td data-label="Producto" class="col-producto" title="${escapeHtml(r.descripcion)}">${escapeHtml(r.descripcion)}</td>
                        <td data-label="¿Aplica Canje?">${badgeCanje}</td>
                        <td data-label="Mes a Devolver">${mesDevolver}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center">${alertHTML('error', data.error)}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">${alertHTML('error', 'Error al consultar reglas.')}</td></tr>`;
    }
}
