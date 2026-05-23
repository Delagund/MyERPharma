// ============================================================
//  MyErPharma — App Shell JS (Core & Router)
// ============================================================

// Interceptor global de fetch para inyectar token CSRF en peticiones modificadoras
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(resource, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            options.headers = options.headers || {};
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            if (token) {
                if (options.headers instanceof Headers) {
                    options.headers.set('X-CSRF-Token', token);
                } else if (Array.isArray(options.headers)) {
                    options.headers.push(['X-CSRF-Token', token]);
                } else {
                    options.headers['X-CSRF-Token'] = token;
                }
            }
        }
        return originalFetch(resource, options);
    };
})();

/* ---- Menú Hamburguesa (Móvil Drawer) ---- */
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const menuBtn        = document.getElementById('menu-btn');

function openSidebar() {
    sidebar?.classList.add('open');
    sidebarOverlay?.classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('visible');
    document.body.style.overflow = '';
}

menuBtn?.addEventListener('click', openSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);

// Cerrar sidebar al navegar en móvil y tablet (pantallas <= 1024px)
document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth <= 1024) closeSidebar();
    });
});

/* ---- Carga de Contenido de Páginas (Router SPA) ---- */
const pageContent = document.getElementById('page-content');

const pageModules = {
    dashboard:   loadDashboard,
    entrada:     loadEntrada,
    salida:      loadSalida,
    traslado:    loadTraslado,
    inventario:  loadInventario,
    productos:   loadProductos,
    ubicaciones: loadUbicaciones,
    reportes:    loadReportes,
    perfil:      loadPerfil,
    logistica:   typeof loadLogistica !== 'undefined' ? loadLogistica : null,
    historial:   loadHistorial,
    changelog:   loadChangelog,
};

document.addEventListener('DOMContentLoaded', () => {
    // Intercepción de permisos para el Historial (Kardex)
    if (APP_PAGE === 'historial' && APP_USER.role !== 'admin') {
        showToast('Acceso denegado. Se requieren permisos de administrador.', 'error');
        setTimeout(() => {
            window.location.href = '?p=dashboard';
        }, 1500);
        return;
    }

    const loader = pageModules[APP_PAGE];
    if (loader) {
        loader();
    } else {
        pageContent.innerHTML = '<p class="text-muted">Página no encontrada.</p>';
    }

    // Cargar alertas de vencimiento
    loadExpiryAlerts();

    // Inicializamos el bloqueo de Enter en búsquedas y el capturador global de lector
    initEnterKeyPrevention();
    initGlobalScannerListener();
});

/* ---- Alertas de Vencimiento (Topbar) ---- */
async function loadExpiryAlerts() {
    try {
        const res  = await fetch('api/inventario.php?action=expiry_alerts');
        const data = await res.json();
        if (data.count > 0) {
            const badge   = document.getElementById('expiry-alert');
            const counter = document.getElementById('expiry-count');
            if (badge && counter) {
                counter.textContent = data.count;
                badge.style.display = 'flex';
            }
            // Añadir badge en el nav de inventario
            const navInv = document.getElementById('nav-inventario');
            if (navInv && !navInv.querySelector('.nav-badge')) {
                const badge = document.createElement('span');
                badge.className = 'nav-badge';
                badge.textContent = data.count;
                navInv.appendChild(badge);
            }
        }
    } catch (e) {
        // Silenciar errores de conectividad
    }
}

/* ---- REPORTES (Módulo simple integrado) ---- */
function loadReportes() {
    const isAdmin = (APP_USER.role === 'admin');
    pageContent.innerHTML = `
        <div class="stat-grid mb-6">
            <a href="api/inventario.php?action=export" class="stat-card cursor-pointer">
                <div class="stat-icon primary">⬇️</div>
                <div class="stat-body">
                    <div class="stat-value text-lg">Inventario Completo</div>
                    <div class="stat-label">Exportar todo el stock actual en CSV</div>
                </div>
            </a>
            <a href="api/inventario.php?action=export&filter=expiry30" class="stat-card cursor-pointer">
                <div class="stat-icon warning">📅</div>
                <div class="stat-body">
                    <div class="stat-value text-lg">Vencen &lt; 30 días</div>
                    <div class="stat-label">Exportar productos críticos próximos a vencer</div>
                </div>
            </a>
            <a href="api/inventario.php?action=export&filter=vencidos" class="stat-card cursor-pointer">
                <div class="stat-icon danger">🚨</div>
                <div class="stat-body">
                    <div class="stat-value text-lg">Lotes Vencidos</div>
                    <div class="stat-label">Exportar todos los lotes ya vencidos</div>
                </div>
            </a>
            <a href="api/reportes_canjes.php?export=1" class="stat-card cursor-pointer">
                <div class="stat-icon success">🔄</div>
                <div class="stat-body">
                    <div class="stat-value text-lg">Canjes y Vencimientos</div>
                    <div class="stat-label">Exportar tabla de logística inversa a CSV</div>
                </div>
            </a>
            <a href="${isAdmin ? '?p=historial' : '#'}" class="stat-card ${isAdmin ? 'cursor-pointer' : 'nav-item-disabled'}" 
               ${!isAdmin ? 'title="Solo disponible para administradores"' : ''}>
                <div class="stat-icon info">📋</div>
                <div class="stat-body">
                    <div class="stat-value text-lg">Historial (Kardex)</div>
                    <div class="stat-label">Consulta la bitácora completa con filtros avanzados</div>
                </div>
            </a>
        </div>`;
}

/* ---- Cargar opciones de Ubicaciones en un <select> ---- */
async function loadUbicacionesSelect(selectId) {
    try {
        const res  = await fetch('api/ubicaciones.php?action=list');
        const data = await res.json();
        const sel = document.getElementById(selectId);
        if (!sel) return;
        (data.rows ?? []).forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = `${r.codigo}${r.descripcion ? ' — ' + r.descripcion : ''}`;
            sel.appendChild(opt);
        });
    } catch (e) { /* silenciar */ }
}

/* ============================================================
   LÓGICA Y UX DE ESCÁNER DE CÓDIGO DE BARRAS
   ============================================================ */

let ultimoCodigoEscaneado = '';
let timestampUltimoEscaneo = 0;

function esEscaneoDuplicado(barcode) {
    const ahora = Date.now();
    if (barcode === ultimoCodigoEscaneado && (ahora - timestampUltimoEscaneo < 400)) {
        return true;
    }
    ultimoCodigoEscaneado = barcode;
    timestampUltimoEscaneo = ahora;
    return false;
}

function initEnterKeyPrevention() {
    const preventEnterSelectors = [
        '#entrada-codigo',
        '#entrada-ubicacion-text',
        '#salida-codigo',
        '#traslado-codigo',
        '#traslado-destino',
        '#inv-search',
        '#prod-search',
        '#busqueda-regla'
    ];
    
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const activeEl = document.activeElement;
            if (activeEl && preventEnterSelectors.some(selector => activeEl.matches(selector))) {
                e.preventDefault();
                
                const val = activeEl.value.trim();
                if (val.length >= 2) {
                    if (activeEl.id === 'entrada-codigo') {
                        handleEntradaScan(val);
                    } else if (activeEl.id === 'salida-codigo') {
                        handleSalidaScan(val);
                    } else if (activeEl.id === 'traslado-codigo') {
                        handleTrasladoScan(val);
                    } else {
                        activeEl.dispatchEvent(new Event('input'));
                        if (APP_PAGE === 'logistica' && typeof buscarReglas === 'function') {
                            buscarReglas();
                        }
                    }
                }
            }
        }
    });
}

function initGlobalScannerListener() {
    let scannerBuffer = '';
    let lastKeyTime = 0;

    window.addEventListener('keydown', e => {
        if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) {
            return;
        }

        const currentTime = Date.now();
        
        if (currentTime - lastKeyTime > 50) {
            scannerBuffer = '';
        }
        
        lastKeyTime = currentTime;

        if (e.key === 'Enter') {
            if (scannerBuffer.length >= 3) {
                const activeEl = document.activeElement;
                const directInputs = ['entrada-codigo', 'salida-codigo', 'traslado-codigo'];
                if (activeEl && directInputs.includes(activeEl.id)) {
                    scannerBuffer = '';
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                handleGlobalScan(scannerBuffer);
                scannerBuffer = '';
            }
            return;
        }

        if (e.key.length === 1) {
            scannerBuffer += e.key;
        }
    });
}

function getActiveScanInput() {
    if (APP_PAGE === 'entrada') return document.getElementById('entrada-codigo');
    if (APP_PAGE === 'salida') return document.getElementById('salida-codigo');
    if (APP_PAGE === 'traslado') return document.getElementById('traslado-codigo');
    if (APP_PAGE === 'inventario') return document.getElementById('inv-search');
    if (APP_PAGE === 'productos') return document.getElementById('prod-search');
    if (APP_PAGE === 'logistica') return document.getElementById('busqueda-regla');
    return null;
}

async function handleGlobalScan(barcode) {
    const input = getActiveScanInput();
    if (!input) return;

    input.value = barcode;
    input.focus();

    if (APP_PAGE === 'entrada') {
        await handleEntradaScan(barcode);
    } else if (APP_PAGE === 'salida') {
        await handleSalidaScan(barcode);
    } else if (APP_PAGE === 'traslado') {
        await handleTrasladoScan(barcode);
    } else {
        input.dispatchEvent(new Event('input'));
        if (APP_PAGE === 'logistica' && typeof buscarReglas === 'function') {
            buscarReglas();
        }
    }
}

async function handleEntradaScan(barcode) {
    if (!barcode) return;
    if (esEscaneoDuplicado(barcode)) return;

    try {
        const res = await fetch(`api/productos.php?action=search&q=${encodeURIComponent(barcode)}`);
        const data = await res.json();
        const results = data.results ?? [];
        const exactMatch = results.find(r => r.match_type === 'exact_barcode' || r.match_type === 'exact_socofar');
        const match = exactMatch || (results.length === 1 ? results[0] : null);

        if (match) {
            const currentSelectedId = document.getElementById('entrada-producto-id')?.value;
            if (currentSelectedId && parseInt(currentSelectedId) === parseInt(match.id)) {
                const cantInput = document.getElementById('entrada-cantidad');
                if (cantInput) {
                    const val = parseInt(cantInput.value) || 0;
                    cantInput.value = val + 1;
                    showToast(`Cantidad incrementada a ${val + 1} para ${match.descripcion}`, 'info');
                    playScanSound('success');
                }
                const codigoInput = document.getElementById('entrada-codigo');
                if (codigoInput) {
                    codigoInput.value = '';
                    codigoInput.focus();
                }
                return;
            }

            document.getElementById('entrada-producto-id').value = match.id;
            document.getElementById('producto-nombre').textContent = match.descripcion;
            document.getElementById('producto-info').style.display = 'block';
            document.getElementById('entrada-ac-results').classList.remove('visible');

            const cantInput = document.getElementById('entrada-cantidad');
            if (cantInput && (!cantInput.value || parseInt(cantInput.value) === 0)) {
                cantInput.value = 1;
            }

            playScanSound('success');
            showToast(`Producto seleccionado: ${match.descripcion}`, 'success');
            document.getElementById('entrada-lote')?.focus();
        } else {
            playScanSound('error');
            showToast('Producto no encontrado en el maestro.', 'warning');
            document.getElementById('entrada-ac-results').classList.remove('visible');
        }
    } catch (e) {
        playScanSound('error');
        showToast('Error al buscar el producto.', 'error');
    }
}

async function handleSalidaScan(barcode) {
    if (!barcode) return;
    if (esEscaneoDuplicado(barcode)) return;

    try {
        const res = await fetch(`api/productos.php?action=search&q=${encodeURIComponent(barcode)}`);
        const data = await res.json();
        const results = data.results ?? [];
        const exactMatch = results.find(r => r.match_type === 'exact_barcode' || r.match_type === 'exact_socofar');
        const match = exactMatch || (results.length === 1 ? results[0] : null);

        if (match) {
            const currentSelectedId = document.getElementById('salida-producto-id')?.value;
            if (currentSelectedId && parseInt(currentSelectedId) === parseInt(match.id)) {
                playScanSound('success');
                return;
            }

            document.getElementById('salida-producto-nombre').textContent = match.descripcion;
            document.getElementById('salida-producto-id').value = match.id;
            document.getElementById('salida-ubicaciones-section').style.display = 'block';
            document.getElementById('salida-ac-results').classList.remove('visible');

            const lista = document.getElementById('salida-lotes-lista');
            lista.innerHTML = '<div class="loading-spinner" style="padding:1rem">Buscando ubicaciones...</div>';
            
            const resLotes = await fetch(`api/inventario.php?action=stock_by_product&producto_id=${match.id}`);
            const dataLotes = await resLotes.json();

            if (!dataLotes.rows || !dataLotes.rows.length) {
                lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><h3>Sin stock</h3><p>Este producto no tiene ubicaciones con stock disponible.</p></div>';
                playScanSound('error');
                showToast('Este producto no tiene stock disponible.', 'warning');
                return;
            }

            lista.innerHTML = dataLotes.rows.map(r => `
                <label class="lote-selection-card lote-row">
                    <input type="radio" name="inventario_sel" value="${r.id}" data-max="${r.cantidad}">
                    <div class="flex-1">
                        <div class="font-semibold text-sm">Lote: ${escapeHtml(r.numero_lote)}</div>
                        <div class="text-xs text-secondary">
                            Ubicación: <strong>${escapeHtml(r.ubicacion_codigo)}</strong> — 
                            Vence: <span class="badge badge-${expiryBadgeClass(r.fecha_vencimiento)}">${formatDate(r.fecha_vencimiento)}</span>
                        </div>
                    </div>
                    <span class="font-bold text-primary">${r.cantidad} <span class="font-normal text-xs text-muted">unid.</span></span>
                </label>`).join('');

            let selectedMaxCantidad = 0;
            lista.querySelectorAll('input[name="inventario_sel"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    document.getElementById('salida-cantidad-section').style.display = 'block';
                    selectedMaxCantidad = parseInt(radio.dataset.max);
                    document.getElementById('salida-stock-hint').textContent = `Disponible: ${selectedMaxCantidad} unidades.`;
                    document.getElementById('salida-submit').disabled = false;
                    document.getElementById('salida-cantidad').max = selectedMaxCantidad;
                    document.getElementById('salida-cantidad').value = 1;
                    document.getElementById('salida-cantidad')?.focus();
                    lista.querySelectorAll('.lote-row').forEach(l => l.style.borderColor = 'var(--border)');
                    radio.closest('.lote-row').style.borderColor = 'var(--primary)';
                });
            });

            if (dataLotes.rows.length === 1) {
                const radio = lista.querySelector('input[name="inventario_sel"]');
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            }

            playScanSound('success');
            showToast(`Producto seleccionado: ${match.descripcion}`, 'success');
        } else {
            playScanSound('error');
            showToast('Producto no encontrado.', 'warning');
            document.getElementById('salida-ac-results').classList.remove('visible');
        }
    } catch (e) {
        playScanSound('error');
        showToast('Error al buscar el producto.', 'error');
    }
}

async function handleTrasladoScan(barcode) {
    if (!barcode) return;
    if (esEscaneoDuplicado(barcode)) return;

    try {
        const res = await fetch(`api/productos.php?action=search&q=${encodeURIComponent(barcode)}`);
        const data = await res.json();
        const results = data.results ?? [];
        const exactMatch = results.find(r => r.match_type === 'exact_barcode' || r.match_type === 'exact_socofar');
        const match = exactMatch || (results.length === 1 ? results[0] : null);

        if (match) {
            const currentSelectedId = document.getElementById('traslado-producto-id')?.value;
            if (currentSelectedId && parseInt(currentSelectedId) === parseInt(match.id)) {
                playScanSound('success');
                return;
            }

            document.getElementById('traslado-producto-nombre').textContent = match.descripcion;
            document.getElementById('traslado-producto-id').value = match.id;
            document.getElementById('traslado-seccion-detalles').style.display = 'block';
            document.getElementById('traslado-ac-results').classList.remove('visible');

            const lista = document.getElementById('traslado-lotes-lista');
            lista.innerHTML = '<div class="loading-spinner" style="padding:1rem">Buscando stock...</div>';

            const resLotes = await fetch(`api/inventario.php?action=stock_by_product&producto_id=${match.id}`);
            const dataLotes = await resLotes.json();

            if (!dataLotes.rows || !dataLotes.rows.length) {
                lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><h3>Sin stock</h3><p>Este producto no tiene ubicaciones con stock disponible.</p></div>';
                playScanSound('error');
                showToast('Este producto no tiene stock disponible.', 'warning');
                return;
            }

            lista.innerHTML = dataLotes.rows.map(r => `
                <label class="lote-selection-card lote-row">
                    <input type="radio" name="inventario_sel" value="${r.id}" data-max="${r.cantidad}" data-codigo="${escapeHtml(r.ubicacion_codigo)}" data-lote="${escapeHtml(r.numero_lote)}">
                    <div class="flex-1">
                        <div class="font-semibold text-sm">Lote: ${escapeHtml(r.numero_lote)}</div>
                        <div class="text-xs text-secondary">
                            Ubicación: <strong>${escapeHtml(r.ubicacion_codigo)}</strong> — 
                            Vence: <span class="badge badge-${expiryBadgeClass(r.fecha_vencimiento)}">${formatDate(r.fecha_vencimiento)}</span>
                        </div>
                    </div>
                    <span class="font-bold text-primary">${r.cantidad} <span class="font-normal text-xs text-muted">unid.</span></span>
                </label>`).join('');

            lista.querySelectorAll('input[name="inventario_sel"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    document.getElementById('traslado-destino-wrapper').style.display = 'block';
                    document.getElementById('flow-origen-val').textContent = `${radio.dataset.codigo} (L: ${radio.dataset.lote})`;
                    document.getElementById('traslado-flow').style.display = 'flex';
                    document.getElementById('traslado-destino')?.focus();
                    lista.querySelectorAll('.lote-row').forEach(l => l.style.borderColor = 'var(--border)');
                    radio.closest('.lote-row').style.borderColor = 'var(--primary)';
                });
            });

            if (dataLotes.rows.length === 1) {
                const radio = lista.querySelector('input[name="inventario_sel"]');
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            }

            playScanSound('success');
            showToast('Producto seleccionado', 'success');
        } else {
            playScanSound('error');
            showToast('Producto no encontrado.', 'warning');
            document.getElementById('traslado-ac-results').classList.remove('visible');
        }
    } catch (e) {
        playScanSound('error');
        showToast('Error al buscar el producto.', 'error');
    }
}

function playScanSound(type = 'success') {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (type === 'success') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 1000;
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.08);
        } else {
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            osc1.frequency.value = 300;
            gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
            osc1.start();
            osc1.stop(audioCtx.currentTime + 0.15);

            setTimeout(() => {
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.frequency.value = 250;
                gain2.gain.setValueAtTime(0.12, audioCtx.currentTime);
                osc2.start();
                osc2.stop(audioCtx.currentTime + 0.15);
            }, 180);
        }
    } catch (e) {
        // Silenciar errores
    }
}

/* ============================================================
   UTILIDADES GENÉRICAS Y DE FORMATO
   ============================================================ */

function showLoading() {
    pageContent.innerHTML = `
        <div class="loading-spinner p-8">
            <svg class="spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                      stroke="#4f46e5" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Cargando...
        </div>`;
}

function alertHTML(type, msg) {
    const icons = {
        success: '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        error:   '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        warning: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        info:    '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    };
    return `<div class="alert alert-${type}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">${icons[type] || icons.info}</svg>
        ${escapeHtml(msg)}
    </div>`;
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function showToast(msg, type = 'success', duration = 2500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = {
        success: '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
        error:   '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        warning: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        info:    '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">${icons[type] || icons.info}</svg>
        <span class="toast-msg">${escapeHtml(msg)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Cerrar">✕</button>
    `;

    container.appendChild(toast);
    
    // Forzar reflow
    toast.offsetHeight; 
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split(' ');
    const datePart = parts[0];
    const timePart = parts[1] ? parts[1].substring(0, 5) : '';
    const d = new Date(datePart + 'T00:00:00');
    const fDate = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return timePart ? `${fDate} ${timePart}` : fDate;
}

function expiryBadgeClass(dateStr) {
    const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
    if (diff < 0)  return 'danger';
    if (diff < 30) return 'danger';
    if (diff < 90) return 'warning';
    return 'success';
}

// Listener de clic global para alternar la expansión de tarjetas de tabla en móviles (<= 768px)
document.addEventListener('click', e => {
    const tr = e.target.closest('.data-table tbody tr');
    if (tr && window.innerWidth <= 768) {
        // Si el clic es sobre un botón, enlace, input o select de la fila expandida,
        // no alternar la expansión para permitir que se ejecute la acción correspondiente.
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('select')) {
            return;
        }
        
        // Evitar alternar expansión si es una fila de carga, spinner o vacía (sin celdas con data-label)
        if (!tr.querySelector('td[data-label]')) {
            return;
        }
        
        tr.classList.toggle('expanded');
    }
});
