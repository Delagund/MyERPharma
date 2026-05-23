// ============================================================
//  js/ubicaciones.js — Módulo de Ubicaciones
// ============================================================

let ubicCurrentPage = 1;
let ubicCurrentSearch = '';

async function loadUbicaciones() {
    ubicCurrentPage = 1;
    ubicCurrentSearch = '';
    showLoading();
    
    pageContent.innerHTML = `
        <div class="layout-split-panel">
            <div class="card panel-sidebar">
                <div class="card-header">
                    <span class="card-title" id="ubic-form-title">Nueva Ubicación</span>
                </div>
                <div class="card-body">
                    <form id="ubicacion-form" novalidate>
                        <input type="hidden" id="ubic-id">
                        <div class="form-group">
                            <label class="form-label" for="ubic-codigo">Código *</label>
                            <input type="text" id="ubic-codigo" name="codigo" class="form-input" placeholder="Ej: 604280" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="ubic-desc">Descripción (opcional)</label>
                            <input type="text" id="ubic-desc" name="descripcion" class="form-input" placeholder="Ej: Bodega Principal - Pasillo A">
                        </div>
                        <div id="ubic-feedback"></div>
                        <div class="flex gap-2 mt-3">
                            <button type="submit" class="btn btn-primary flex-1" id="ubic-submit-btn">Guardar Ubicación</button>
                            <button type="button" class="btn btn-secondary" id="ubic-cancel-btn" style="display:none" onclick="resetUbicacionForm()">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>

            <div class="card panel-content">
                <div class="card-header">
                    <span class="card-title">Ubicaciones Registradas</span>
                </div>
                <div class="table-toolbar">
                    <div class="search-input-wrapper">
                        <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                            <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <input type="text" class="search-input" id="ubic-search" placeholder="Buscar por código o descripción...">
                    </div>
                </div>
                <div class="table-wrapper">
                    <table class="data-table" id="ubicaciones-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th class="text-center col-actions">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="ubic-tbody">
                            <tr><td colspan="3"><div class="loading-spinner p-8">Cargando...</div></td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="pagination card-footer-action mt-3">
                    <span class="pagination-info text-xs text-secondary" id="ubic-count"></span>
                    <div class="pagination-controls flex-items-center gap-2">
                        <button id="ubic-btn-prev" class="btn btn-xs btn-secondary" disabled>←</button>
                        <span id="ubic-page-info" class="text-xs font-semibold"></span>
                        <button id="ubic-btn-next" class="btn btn-xs btn-secondary" disabled>→</button>
                    </div>
                </div>
            </div>
        </div>`;
 
    initUbicacionesPage();
    await fetchUbicacionesPage();
}
 
function renderUbicacionesRows(rows) {
    if (!rows.length) return '<tr><td colspan="3"><div class="empty-state"><div class="empty-state-icon">📭</div><p>Sin ubicaciones registradas.</p></div></td></tr>';
    return rows.map(r => `
        <tr>
            <td data-label="Código"><span class="badge badge-neutral">${escapeHtml(r.codigo)}</span></td>
            <td data-label="Descripción">${escapeHtml(r.descripcion ?? '—')}</td>
            <td data-label="Acciones" class="text-center nowrap">
                ${parseInt(r.id) === 1 ? `
                    <span class="text-xs text-secondary font-normal italic">Sistema</span>
                ` : `
                    <button class="btn btn-sm btn-secondary" onclick="editUbicacion(${r.id}, '${escapeHtml(r.codigo)}', '${escapeHtml(r.descripcion ?? '')}')" title="Editar">
                        ✏️
                    </button>
                    <button class="btn btn-sm btn-danger ml-1" onclick="deleteUbicacion(${r.id}, '${escapeHtml(r.codigo)}')" title="Eliminar">
                        🗑️
                    </button>
                `}
            </td>
        </tr>`).join('');
}

function initUbicacionesPage() {
    let debounceTimer;
    document.getElementById('ubic-search')?.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            ubicCurrentSearch = e.target.value.trim();
            ubicCurrentPage = 1;
            fetchUbicacionesPage();
        }, 300);
    });

    document.getElementById('ubic-btn-prev')?.addEventListener('click', () => {
        if (ubicCurrentPage > 1) {
            ubicCurrentPage--;
            fetchUbicacionesPage();
        }
    });

    document.getElementById('ubic-btn-next')?.addEventListener('click', () => {
        ubicCurrentPage++;
        fetchUbicacionesPage();
    });

    document.getElementById('ubicacion-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const feedback  = document.getElementById('ubic-feedback');
        const submitBtn = document.getElementById('ubic-submit-btn');
        const id        = document.getElementById('ubic-id').value;
        const codigo    = document.getElementById('ubic-codigo').value.trim();
        const desc      = document.getElementById('ubic-desc').value.trim();

        if (!codigo) { feedback.innerHTML = alertHTML('error', 'El código es obligatorio.'); return; }
        if (id && parseInt(id) === 1) { feedback.innerHTML = alertHTML('error', 'La ubicación del sistema no puede ser modificada.'); return; }

        const isEdit = !!id;
        const action = isEdit ? 'update' : 'create';
        const payload = isEdit
            ? { id: parseInt(id), codigo, descripcion: desc }
            : { codigo, descripcion: desc };

        submitBtn.disabled = true;
        try {
            const res  = await fetch(`api/ubicaciones.php?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.ok) {
                feedback.innerHTML = alertHTML('success', isEdit ? 'Ubicación actualizada.' : 'Ubicación guardada.');
                resetUbicacionForm();
                await fetchUbicacionesPage();
            } else {
                feedback.innerHTML = alertHTML('error', data.error ?? 'Error al guardar.');
            }
        } catch (err) {
            feedback.innerHTML = alertHTML('error', 'Error de conexión.');
        } finally {
            submitBtn.disabled = false;
        }
    });
}

async function fetchUbicacionesPage() {
    const tbody = document.getElementById('ubic-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3"><div class="loading-spinner p-4">Buscando...</div></td></tr>';

    try {
        const res  = await fetch(`api/ubicaciones.php?action=list&page=${ubicCurrentPage}&q=${encodeURIComponent(ubicCurrentSearch)}`);
        const data = await res.json();

        if (data.ok === false) {
            tbody.innerHTML = `<tr><td colspan="3">${alertHTML('error', data.error || 'Error en el servidor')}</td></tr>`;
            return;
        }

        tbody.innerHTML = renderUbicacionesRows(data.rows ?? []);
        
        document.getElementById('ubic-count').textContent = `Total: ${data.total ?? 0}`;
        document.getElementById('ubic-page-info').textContent = `${data.page ?? 1} / ${data.total_pages || 1}`;
        document.getElementById('ubic-btn-prev').disabled = (data.page ?? 1) <= 1;
        document.getElementById('ubic-btn-next').disabled = (data.page ?? 1) >= (data.total_pages || 1);

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state">Error de conexión al cargar datos.</div></td></tr>';
    }
}

window.resetUbicacionForm = function() {
    document.getElementById('ubic-id').value = '';
    document.getElementById('ubicacion-form')?.reset();
    document.getElementById('ubic-feedback').innerHTML = '';
    document.getElementById('ubic-form-title').textContent = 'Nueva Ubicación';
    document.getElementById('ubic-submit-btn').textContent = 'Guardar Ubicación';
    document.getElementById('ubic-cancel-btn').style.display = 'none';
};

window.editUbicacion = function(id, codigo, descripcion) {
    if (parseInt(id) === 1) {
        alert('La ubicación del sistema no puede ser editada.');
        return;
    }
    document.getElementById('ubic-id').value      = id;
    document.getElementById('ubic-codigo').value  = codigo;
    document.getElementById('ubic-desc').value    = descripcion;
    document.getElementById('ubic-form-title').textContent   = 'Editar Ubicación';
    document.getElementById('ubic-submit-btn').textContent   = 'Actualizar Ubicación';
    document.getElementById('ubic-cancel-btn').style.display = 'inline-flex';
    document.getElementById('ubic-feedback').innerHTML = '';
    document.getElementById('ubic-codigo')?.focus();
};

window.deleteUbicacion = async function(id, codigo) {
    if (parseInt(id) === 1) {
        alert('La ubicación del sistema no puede ser eliminada.');
        return;
    }
    if (!confirm(`¿Eliminar la ubicación "${codigo}"? Esta acción no se puede deshacer.`)) return;
    try {
        const res  = await fetch('api/ubicaciones.php?action=delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.ok) {
            await fetchUbicacionesPage();
        } else {
            alert('Error: ' + (data.error ?? 'No se pudo eliminar.'));
        }
    } catch (err) {
        alert('Error de conexión al intentar eliminar.');
    }
};
