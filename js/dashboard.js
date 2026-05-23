// ============================================================
//  js/dashboard.js — Módulo Dashboard
// ============================================================

async function loadDashboard() {
    showLoading();
    try {
        const res  = await fetch('api/dashboard.php');
        const data = await res.json();
        
        let matrizBanner = '';
        try {
            const matRes = await fetch('api/estado_matriz.php');
            const matData = await matRes.json();
            if (matData.ok && matData.alerta_activa) {
                matrizBanner = alertHTML('warning', 'La matriz de canjes tiene más de 30 días de antigüedad o no ha sido cargada este mes. Por favor, actualice el archivo en el módulo de Logística Inversa.');
                matrizBanner = `<div class="mb-4">${matrizBanner}</div>`;
            }
        } catch (e) {}

        pageContent.innerHTML = matrizBanner + `
            <div class="stat-grid">
                <div class="stat-card">
                    <div class="stat-icon primary">📦</div>
                    <div class="stat-body">
                        <div class="stat-value">${data.total_productos ?? '—'}</div>
                        <div class="stat-label">Productos Maestros</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success">✅</div>
                    <div class="stat-body">
                        <div class="stat-value">${data.total_lotes ?? '—'}</div>
                        <div class="stat-label">Lotes en Stock</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon warning">⚠️</div>
                    <div class="stat-body">
                        <div class="stat-value">${data.proximos_vencer ?? '—'}</div>
                        <div class="stat-label">Vencen en &lt;30 días</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon danger">🚨</div>
                    <div class="stat-body">
                        <div class="stat-value">${data.vencidos ?? '—'}</div>
                        <div class="stat-label">Lotes Vencidos</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <span class="card-title">⚠️ Próximos a Vencer (90 días)</span>
                    <a href="?p=reportes" class="btn btn-sm btn-secondary">Ver todos</a>
                </div>
                <div class="table-wrapper">
                    <table class="data-table" id="expiry-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Producto</th>
                                <th>Lote</th>
                                <th>Vencimiento</th>
                                <th>Ubicación</th>
                                <th>Cantidad</th>
                            </tr>
                        </thead>
                        <tbody id="expiry-tbody">
                            ${renderExpiryRows(data.expiry_soon ?? [])}
                        </tbody>
                    </table>
                </div>
            </div>`;
    } catch (e) {
        pageContent.innerHTML = alertHTML('error', 'Error al cargar el dashboard. Verifica la conexión.');
    }
}

function renderExpiryRows(rows) {
    if (!rows.length) return `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">✅</div><h3>Sin vencimientos próximos</h3><p>No hay lotes con vencimiento en los próximos 90 días.</p></div></td></tr>`;
    return rows.map(r => `
        <tr>
            <td data-label="Código"><span class="badge badge-info">${escapeHtml(r.cod_socofar)}</span></td>
            <td data-label="Producto" class="col-producto" title="${escapeHtml(r.descripcion)}">${escapeHtml(r.descripcion)}</td>
            <td data-label="Lote">${escapeHtml(r.numero_lote)}</td>
            <td data-label="Vencimiento"><span class="badge badge-${expiryBadgeClass(r.fecha_vencimiento)}">${formatDate(r.fecha_vencimiento)}</span></td>
            <td data-label="Ubicación"><span class="badge badge-neutral">${escapeHtml(r.ubicacion_codigo ?? '—')}</span></td>
            <td data-label="Cantidad"><strong>${r.cantidad}</strong></td>
        </tr>`).join('');
}
