// ============================================================
//  js/inventario.js — Módulo de Consulta de Inventario
// ============================================================

let invCurrentPage = 1;
let invCurrentSearch = '';
let invCurrentExpiry = '';

async function loadInventario() {
    invCurrentPage = 1;
    invCurrentSearch = '';
    invCurrentExpiry = '';
    
    pageContent.innerHTML = `
        <div class="card">
            <div class="table-toolbar gap-4">
                <div class="search-input-wrapper flex-1">
                    <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                        <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <input type="text" class="search-input" id="inv-search" placeholder="Buscar por producto, código, lote o ubicación...">
                </div>
                <select id="inv-expiry-filter" class="form-select inv-select-filter">
                    <option value="">Todos los vencimientos</option>
                    <option value="30">Vencen ≤ 30 días</option>
                    <option value="60">Vencen ≤ 60 días</option>
                    <option value="90">Vencen ≤ 90 días</option>
                </select>
                <a href="api/inventario.php?action=export" class="btn btn-secondary btn-sm" id="inv-btn-export">
                    ⬇ Exportar CSV
                </a>
            </div>
            <div class="table-wrapper">
                <table class="data-table" id="inventario-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Producto</th>
                            <th>Lote</th>
                            <th>Vencimiento</th>
                            <th>Ubicación</th>
                            <th>Cantidad</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody id="inv-tbody">
                        <tr><td colspan="7"><div class="loading-spinner p-8">Cargando inventario...</div></td></tr>
                    </tbody>
                </table>
            </div>
            <div class="pagination flex-between-center">
                <span class="pagination-info" id="inv-count">Cargando...</span>
                <div class="pagination-controls flex-items-center gap-2">
                    <button id="inv-btn-prev" class="btn btn-sm btn-secondary" disabled>Anterior</button>
                    <span id="inv-page-info" class="text-sm font-medium">Página 1</span>
                    <button id="inv-btn-next" class="btn btn-sm btn-secondary" disabled>Siguiente</button>
                </div>
            </div>
        </div>`;

    let debounceTimer;
    document.getElementById('inv-search')?.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            invCurrentSearch = e.target.value.trim();
            invCurrentPage = 1;
            fetchInventarioPage();
        }, 300);
    });

    document.getElementById('inv-expiry-filter')?.addEventListener('change', (e) => {
        invCurrentExpiry = e.target.value;
        invCurrentPage = 1;
        fetchInventarioPage();
    });

    document.getElementById('inv-btn-prev')?.addEventListener('click', () => {
        if (invCurrentPage > 1) {
            invCurrentPage--;
            fetchInventarioPage();
        }
    });

    document.getElementById('inv-btn-next')?.addEventListener('click', () => {
        invCurrentPage++;
        fetchInventarioPage();
    });

    await fetchInventarioPage();
}

async function fetchInventarioPage() {
    const tbody = document.getElementById('inv-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="7"><div class="loading-spinner p-8">Buscando...</div></td></tr>`;
    
    try {
        const url = `api/inventario.php?action=list&page=${invCurrentPage}&q=${encodeURIComponent(invCurrentSearch)}&expiry_days=${invCurrentExpiry}`;
        const res = await fetch(url);
        const data = await res.json();
        
        tbody.innerHTML = renderInventarioRows(data.rows ?? []);
        
        document.getElementById('inv-count').textContent = `${data.total ?? 0} registros en total`;
        
        const totalPages = data.total_pages ?? 1;
        document.getElementById('inv-page-info').textContent = `Página ${data.page} de ${totalPages}`;
        
        document.getElementById('inv-btn-prev').disabled = data.page <= 1;
        document.getElementById('inv-btn-next').disabled = data.page >= totalPages;

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3>Error</h3><p>Error de conexión al cargar inventario.</p></div></td></tr>`;
    }
}

function renderInventarioRows(rows) {
    if (!rows.length) return `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📭</div><h3>Sin resultados</h3><p>No hay registros de inventario.</p></div></td></tr>`;
    return rows.map(r => `
        <tr>
            <td data-label="Código"><span class="badge badge-info">${escapeHtml(r.cod_socofar)}</span></td>
            <td data-label="Producto" class="col-producto" title="${escapeHtml(r.descripcion)}">${escapeHtml(r.descripcion)}</td>
            <td data-label="Lote">${escapeHtml(r.numero_lote)}</td>
            <td data-label="Vencimiento"><span class="badge badge-${expiryBadgeClass(r.fecha_vencimiento)}">${formatDate(r.fecha_vencimiento)}</span></td>
            <td data-label="Ubicación"><span class="badge badge-neutral">${escapeHtml(r.ubicacion_codigo)}</span></td>
            <td data-label="Cantidad"><strong>${r.cantidad}</strong></td>
            <td data-label="Estado">${expiryStatusBadge(r.fecha_vencimiento)}</td>
        </tr>`).join('');
}

function expiryStatusBadge(dateStr) {
    const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
    if (diff < 0)  return '<span class="badge badge-danger">Vencido</span>';
    if (diff < 30) return '<span class="badge badge-danger">Crítico</span>';
    if (diff < 90) return '<span class="badge badge-warning">Próximo</span>';
    return '<span class="badge badge-success">OK</span>';
}
