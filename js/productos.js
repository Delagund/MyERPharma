// ============================================================
//  js/productos.js — Módulo Mantenedor de Productos
// ============================================================

let prodCurrentPage = 1;
let prodCurrentSearch = '';
let _barcodeCount = 0;

async function loadProductos() {
    prodCurrentPage = 1;
    prodCurrentSearch = '';
    showLoading();
    
    pageContent.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span class="card-title">Mantenedor de Productos</span>
                <button class="btn btn-primary btn-sm" id="btn-new-product">
                    + Nuevo Producto
                </button>
            </div>
            <div class="table-toolbar">
                <div class="search-input-wrapper">
                    <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                        <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <input type="text" class="search-input" id="prod-search" placeholder="Buscar por código o descripción...">
                </div>
            </div>
            <div class="table-wrapper">
                <table class="data-table" id="productos-table">
                    <thead>
                        <tr>
                            <th>Cód. Socofar</th>
                            <th>Descripción</th>
                            <th>Códigos de Barra</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="prod-tbody">
                        <tr><td colspan="4"><div class="loading-spinner p-8">Cargando productos...</div></td></tr>
                    </tbody>
                </table>
            </div>
            <div class="pagination card-footer-action mt-3">
                <span class="pagination-info text-xs text-secondary" id="prod-count"></span>
                <div class="pagination-controls flex-items-center gap-2">
                    <button id="prod-btn-prev" class="btn btn-xs btn-secondary" disabled>←</button>
                    <span id="prod-page-info" class="text-xs font-semibold"></span>
                    <button id="prod-btn-next" class="btn btn-xs btn-secondary" disabled>→</button>
                </div>
            </div>
        </div>
        <!-- Modal Producto -->
        <div class="modal-overlay" id="product-modal">
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title" id="modal-product-title">Nuevo Producto</h2>
                    <button class="modal-close" id="modal-close-btn">✕</button>
                </div>
                <div class="modal-body">
                    <form id="product-form" novalidate>
                        <input type="hidden" id="product-id" name="id">
                        <div class="form-group">
                            <label class="form-label" for="product-cod">Código Socofar *</label>
                            <input type="text" id="product-cod" name="cod_socofar" class="form-input" placeholder="Ej: 1045" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="product-desc">Descripción *</label>
                            <input type="text" id="product-desc" name="descripcion" class="form-input" placeholder="Ej: TONARIL COM.2MG.100" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Códigos de Barra</label>
                            <div id="barcodes-list" class="barcode-list-container"></div>
                            <button type="button" class="btn btn-secondary btn-sm" id="add-barcode-btn">+ Agregar Código de Barra</button>
                        </div>
                        <div id="product-feedback"></div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="modal-cancel-btn">Cancelar</button>
                    <button class="btn btn-primary" id="product-save-btn">Guardar</button>
                </div>
            </div>
        </div>`;

    initProductosPage();
    await fetchProductosPage();
}

function renderProductosRows(rows) {
    if (!rows.length) return `<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">📦</div><h3>Sin productos</h3></div></td></tr>`;
    return rows.map(r => `
        <tr>
            <td data-label="Código"><span class="badge badge-info">${escapeHtml(r.cod_socofar)}</span></td>
            <td data-label="Descripción" class="col-producto" title="${escapeHtml(r.descripcion)}">${escapeHtml(r.descripcion)}</td>
            <td data-label="Códigos Barra" class="text-xs text-secondary">${r.codigos_barra ? escapeHtml(r.codigos_barra) : '—'}</td>
            <td data-label="Acciones">
                <button class="btn btn-sm btn-secondary" onclick="editProducto(${r.id})">Editar</button>
            </td>
        </tr>`).join('');
}

function addBarcodeRow(value = '') {
    _barcodeCount++;
    const div = document.createElement('div');
    div.className = 'input-wrapper';
    div.innerHTML = `
        <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M3 5h2M3 9h2M3 13h2M3 17h2M3 21h2M7 5v16M17 5v16M21 5h-2M21 9h-2M21 13h-2M21 17h-2M21 21h-2M11 5v16M13 5v16"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input type="text"
               name="cod_barra_${_barcodeCount}"
               class="form-input barcode-input"
               placeholder="Código de barra ${_barcodeCount}"
               value="${value.replace(/"/g, '&quot;')}">
        <button type="button" class="toggle-password" onclick="this.parentElement.remove()" title="Eliminar">✕</button>`;
    document.getElementById('barcodes-list').appendChild(div);
}

function initProductosPage() {
    const modal     = document.getElementById('product-modal');
    const closeBtn  = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const saveBtn   = document.getElementById('product-save-btn');
    const newBtn    = document.getElementById('btn-new-product');
    const addBcBtn  = document.getElementById('add-barcode-btn');

    function openModal() { modal.classList.add('open'); }
    function closeModal() {
        modal.classList.remove('open');
        document.getElementById('product-form')?.reset();
        document.getElementById('product-id').value = '';
        document.getElementById('barcodes-list').innerHTML = '';
        _barcodeCount = 0;
        document.getElementById('product-feedback').innerHTML = '';
        document.getElementById('modal-product-title').textContent = 'Nuevo Producto';
    }

    newBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    addBcBtn?.addEventListener('click', () => addBarcodeRow());

    saveBtn?.addEventListener('click', async () => {
        const feedback = document.getElementById('product-feedback');
        const id   = document.getElementById('product-id').value;
        const cod  = document.getElementById('product-cod').value.trim();
        const desc = document.getElementById('product-desc').value.trim();
        if (!cod || !desc) { feedback.innerHTML = alertHTML('error', 'Código y descripción son obligatorios.'); return; }

        const barcodes = [...document.querySelectorAll('#barcodes-list input')].map(i => i.value.trim()).filter(Boolean);
        const action = id ? 'update' : 'create';
        saveBtn.disabled = true;
        try {
            const res  = await fetch(`api/productos.php?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, cod_socofar: cod, descripcion: desc, codigos_barra: barcodes })
            });
            const data = await res.json();
            if (data.ok) {
                closeModal();
                showToast('✅ Producto guardado correctamente', 'success', 2500);
                await fetchProductosPage();
            } else {
                feedback.innerHTML = alertHTML('error', data.error ?? 'Error al guardar.');
            }
        } catch (e) {
            feedback.innerHTML = alertHTML('error', 'Error de conexión.');
        } finally {
            saveBtn.disabled = false;
        }
    });

    let debounceTimer;
    document.getElementById('prod-search')?.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            prodCurrentSearch = e.target.value.trim();
            prodCurrentPage = 1;
            fetchProductosPage();
        }, 300);
    });

    document.getElementById('prod-btn-prev')?.addEventListener('click', () => {
        if (prodCurrentPage > 1) {
            prodCurrentPage--;
            fetchProductosPage();
        }
    });

    document.getElementById('prod-btn-next')?.addEventListener('click', () => {
        prodCurrentPage++;
        fetchProductosPage();
    });
}

async function fetchProductosPage() {
    const tbody = document.getElementById('prod-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4"><div class="loading-spinner p-8">Buscando productos...</div></td></tr>';

    try {
        const res  = await fetch(`api/productos.php?action=list&page=${prodCurrentPage}&q=${encodeURIComponent(prodCurrentSearch)}`);
        const data = await res.json();

        tbody.innerHTML = renderProductosRows(data.rows ?? []);
        
        document.getElementById('prod-count').textContent = `Total: ${data.total ?? 0}`;
        document.getElementById('prod-page-info').textContent = `${data.page} / ${data.total_pages || 1}`;
        document.getElementById('prod-btn-prev').disabled = data.page <= 1;
        document.getElementById('prod-btn-next').disabled = data.page >= (data.total_pages || 1);

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Error al cargar productos.</div></td></tr>';
    }
}

window.editProducto = async function(id) {
    const modal = document.getElementById('product-modal');
    const barcodesList = document.getElementById('barcodes-list');

    document.getElementById('modal-product-title').textContent = 'Editar Producto';
    document.getElementById('product-id').value = id;
    document.getElementById('product-cod').value = '';
    document.getElementById('product-desc').value = '';
    barcodesList.innerHTML = '<div class="loading-spinner p-4 flex-items-center gap-2 text-xs">Cargando...</div>';
    _barcodeCount = 0;
    document.getElementById('product-feedback').innerHTML = '';
    modal.classList.add('open');

    try {
        const res  = await fetch(`api/productos.php?action=get&id=${id}`);
        const data = await res.json();

        if (!data.ok) throw new Error(data.error ?? 'Error al cargar el producto.');

        document.getElementById('product-cod').value  = data.cod_socofar;
        document.getElementById('product-desc').value = data.descripcion;

        barcodesList.innerHTML = '';
        (data.codigos_barra ?? []).forEach(cb => addBarcodeRow(cb));

    } catch (err) {
        barcodesList.innerHTML = '';
        document.getElementById('product-feedback').innerHTML =
            alertHTML('error', err.message ?? 'Error al cargar los datos del producto.');
    }
};
