// ============================================================
//  js/historial.js — Módulo de Historial (Kardex)
// ============================================================

async function loadHistorial() {
    if (APP_USER.role !== 'admin') {
        pageContent.innerHTML = '<div class="alert alert-danger">Acceso denegado. Se requieren permisos de administrador.</div>';
        return;
    }

    pageContent.innerHTML = `
        <div class="card mb-6">
            <div class="card-body">
                <form id="kardex-filter-form" class="filter-form-grid">
                    <div class="form-group mb-0">
                        <label class="form-label" for="filter-kardex-q">Buscar Producto</label>
                        <div class="input-wrapper">
                            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                                <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            <input type="text" id="filter-kardex-q" class="form-input" placeholder="Socofar o descripción..." autocomplete="off">
                        </div>
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label" for="filter-kardex-tipo">Tipo Movimiento</label>
                        <select id="filter-kardex-tipo" class="form-select">
                            <option value="">Todos</option>
                            <option value="1">Entrada</option>
                            <option value="2">Salida</option>
                            <option value="3">Traspaso</option>
                        </select>
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label" for="filter-kardex-desde">Fecha Desde</label>
                        <input type="date" id="filter-kardex-desde" class="form-input">
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label" for="filter-kardex-hasta">Fecha Hasta</label>
                        <input type="date" id="filter-kardex-hasta" class="form-input">
                    </div>
                    <div class="form-group mb-0 flex">
                        <button type="button" id="btn-export-kardex" class="btn btn-success flex-1 btn-export">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M12 3v13m0 0l-4-4m4 4l4-4M4 21h16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Exportar CSV
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <div id="kardex-chips-container" class="filter-chips"></div>

        <div class="card card-overflow-hidden">
            <div class="table-responsive">
                <table class="data-table" id="kardex-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Usuario</th>
                            <th>Tipo</th>
                            <th>Cod. Socofar</th>
                            <th>Producto</th>
                            <th>Lote</th>
                            <th>Vencimiento</th>
                            <th>Origen</th>
                            <th>Destino</th>
                            <th>Cant.</th>
                        </tr>
                    </thead>
                    <tbody id="kardex-table-body">
                        <!-- Cargar con js -->
                    </tbody>
                </table>
            </div>
            <div class="card-footer card-footer-action" id="kardex-pagination">
                <!-- Paginación dinámica -->
            </div>
        </div>
    `;

    const qInput = document.getElementById('filter-kardex-q');
    const tipoSelect = document.getElementById('filter-kardex-tipo');
    const desdeInput = document.getElementById('filter-kardex-desde');
    const hastaInput = document.getElementById('filter-kardex-hasta');
    const exportBtn = document.getElementById('btn-export-kardex');

    let curPage = 1;
    let debounceTimer = null;

    async function fetchKardex(page = 1) {
        curPage = page;
        renderChips();

        const tbody = document.getElementById('kardex-table-body');
        const pagination = document.getElementById('kardex-pagination');
        if (!tbody) return;

        tbody.innerHTML = Array(8).fill(0).map(() => `
            <tr>
                <td colspan="10">
                    <div class="skeleton-row"></div>
                </td>
            </tr>
        `).join('');
        pagination.innerHTML = '<div class="skeleton-text"></div>';

        const q = qInput.value.trim();
        const tipo = tipoSelect.value;
        const desde = desdeInput.value;
        const hasta = hastaInput.value;

        const params = new URLSearchParams({
            action: 'list',
            q,
            tipo_movimiento_id: tipo,
            fecha_desde: desde,
            fecha_hasta: hasta,
            page
        });

        try {
            const res = await fetch(`api/historial.php?${params.toString()}`);
            const data = await res.json();

            if (!data.ok) {
                tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger p-8">${escapeHtml(data.error || 'Error al cargar los datos.')}</td></tr>`;
                pagination.innerHTML = '';
                return;
            }

            if (!data.rows || data.rows.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" class="text-center text-muted p-12">
                            <div class="text-2xl mb-1">📂</div>
                            <strong>No se encontraron registros de movimientos.</strong>
                            <p class="text-xs mt-1">Prueba ajustando los filtros de búsqueda.</p>
                        </td>
                    </tr>`;
                pagination.innerHTML = '';
                return;
            }

            tbody.innerHTML = data.rows.map(r => {
                const badgeClass = r.tipo_movimiento_id == 1 ? 'success' : (r.tipo_movimiento_id == 2 ? 'danger' : 'info');
                const origenBadge = (r.origen && r.origen !== '—') ? `<span class="badge badge-neutral">${escapeHtml(r.origen)}</span>` : '—';
                const destinoBadge = (r.destino && r.destino !== '—') ? `<span class="badge badge-neutral">${escapeHtml(r.destino)}</span>` : '—';
                return `
                    <tr>
                        <td data-label="Fecha">${escapeHtml(formatDateTime(r.fecha))}</td>
                        <td data-label="Usuario"><strong>${escapeHtml(r.usuario)}</strong></td>
                        <td data-label="Tipo"><span class="badge badge-${badgeClass}">${escapeHtml(r.tipo_movimiento)}</span></td>
                        <td data-label="Cod. Socofar"><span class="badge badge-info">${escapeHtml(r.cod_socofar)}</span></td>
                        <td data-label="Producto" class="col-producto" title="${escapeHtml(r.producto)}">${escapeHtml(r.producto)}</td>
                        <td data-label="Lote">${escapeHtml(r.numero_lote)}</td>
                        <td data-label="Vencimiento"><span class="badge badge-${expiryBadgeClass(r.fecha_vencimiento)}">${formatDate(r.fecha_vencimiento)}</span></td>
                        <td data-label="Origen">${origenBadge}</td>
                        <td data-label="Destino">${destinoBadge}</td>
                        <td data-label="Cant."><strong>${r.cantidad}</strong></td>
                    </tr>
                `;
            }).join('');

            let pagHTML = `<div class="text-xs text-secondary">Mostrando página <strong>${data.page}</strong> de <strong>${data.total_pages}</strong> (${data.total} registros en total)</div>`;
            if (data.total_pages > 1) {
                pagHTML += `<div class="flex gap-2">`;
                if (data.page > 1) {
                    pagHTML += `<button class="btn btn-outline btn-xs btn-pag" data-page="${data.page - 1}">Anterior</button>`;
                }
                
                const startRange = Math.max(1, data.page - 2);
                const endRange = Math.min(data.total_pages, data.page + 2);
                for (let i = startRange; i <= endRange; i++) {
                    pagHTML += `<button class="btn btn-xs btn-pag ${i === data.page ? 'btn-primary' : 'btn-outline'}" data-page="${i}">${i}</button>`;
                }

                if (data.page < data.total_pages) {
                    pagHTML += `<button class="btn btn-outline btn-xs btn-pag" data-page="${data.page + 1}">Siguiente</button>`;
                }
                pagHTML += `</div>`;
            }
            pagination.innerHTML = pagHTML;

            pagination.querySelectorAll('.btn-pag').forEach(btn => {
                btn.addEventListener('click', () => {
                    fetchKardex(parseInt(btn.dataset.page));
                });
            });

        } catch (e) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center text-danger p-8">
                        Error de conectividad al servidor. 
                        <button type="button" class="btn btn-xs btn-outline mt-3" id="btn-retry-kardex">Reintentar</button>
                    </td>
                </tr>`;
            pagination.innerHTML = '';
            document.getElementById('btn-retry-kardex')?.addEventListener('click', () => fetchKardex(page));
        }
    }

    function renderChips() {
        const chipsContainer = document.getElementById('kardex-chips-container');
        if (!chipsContainer) return;

        let chips = [];
        if (qInput.value.trim() !== '') {
            chips.push({ id: 'q', text: `Producto: "${qInput.value.trim()}"` });
        }
        if (tipoSelect.value !== '') {
            const label = tipoSelect.options[tipoSelect.selectedIndex].text;
            chips.push({ id: 'tipo', text: `Tipo: ${label}` });
        }
        if (desdeInput.value !== '') {
            chips.push({ id: 'desde', text: `Desde: ${formatDate(desdeInput.value)}` });
        }
        if (hastaInput.value !== '') {
            chips.push({ id: 'hasta', text: `Hasta: ${formatDate(hastaInput.value)}` });
        }

        if (chips.length === 0) {
            chipsContainer.innerHTML = '';
            return;
        }

        let html = chips.map(c => `
            <span class="filter-chip">
                ${escapeHtml(c.text)}
                <span class="filter-chip-remove" data-id="${c.id}">✕</span>
            </span>
        `).join('');

        html += `<span class="btn-clear-filters" id="btn-kardex-clear-all">Limpiar filtros</span>`;
        chipsContainer.innerHTML = html;

        chipsContainer.querySelectorAll('.filter-chip-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                if (id === 'q') qInput.value = '';
                if (id === 'tipo') tipoSelect.value = '';
                if (id === 'desde') desdeInput.value = '';
                if (id === 'hasta') hastaInput.value = '';
                fetchKardex(1);
            });
        });

        document.getElementById('btn-kardex-clear-all')?.addEventListener('click', () => {
            qInput.value = '';
            tipoSelect.value = '';
            desdeInput.value = '';
            hastaInput.value = '';
            fetchKardex(1);
        });
    }

    qInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchKardex(1);
        }, 300);
    });

    tipoSelect.addEventListener('change', () => fetchKardex(1));
    desdeInput.addEventListener('change', () => fetchKardex(1));
    hastaInput.addEventListener('change', () => fetchKardex(1));

    exportBtn.addEventListener('click', () => {
        const q = qInput.value.trim();
        const tipo = tipoSelect.value;
        const desde = desdeInput.value;
        const hasta = hastaInput.value;

        let filtrosAplicados = [];
        if (q) filtrosAplicados.push(`Búsqueda: "${q}"`);
        if (tipo) filtrosAplicados.push(`Tipo: ${tipoSelect.options[tipoSelect.selectedIndex].text}`);
        if (desde) filtrosAplicados.push(`Desde: ${formatDate(desde)}`);
        if (hasta) filtrosAplicados.push(`Hasta: ${formatDate(hasta)}`);

        const txtFiltros = filtrosAplicados.length > 0 
            ? `con los siguientes filtros activos:<br><strong class="text-primary">${filtrosAplicados.join(', ')}</strong>` 
            : 'con el historial completo (sin filtros)';

        const modalDiv = document.createElement('div');
        modalDiv.className = 'modal-backdrop';
        modalDiv.id = 'kardex-export-modal';
        modalDiv.innerHTML = `
            <div class="modal-confirm">
                <div class="modal-confirm-title">
                    <span>📥</span> Confirmar Exportación CSV
                </div>
                <div class="modal-confirm-body">
                    ¿Desea exportar el reporte de movimientos de inventario ${txtFiltros}?
                </div>
                <div class="modal-confirm-actions">
                    <button class="btn btn-outline btn-sm" id="modal-export-cancel">Cancelar</button>
                    <button class="btn btn-success btn-sm" id="modal-export-confirm">Exportar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);

        document.getElementById('modal-export-cancel').addEventListener('click', () => {
            modalDiv.remove();
        });

        document.getElementById('modal-export-confirm').addEventListener('click', () => {
            modalDiv.remove();
            const params = new URLSearchParams({
                action: 'export',
                q,
                tipo_movimiento_id: tipo,
                fecha_desde: desde,
                fecha_hasta: hasta
            });
            window.location.href = `api/historial.php?${params.toString()}`;
            showToast('Descarga iniciada.', 'success');
        });
    });

    fetchKardex(1);
}
