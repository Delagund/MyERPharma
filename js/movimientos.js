// ============================================================
//  js/movimientos.js — Módulo de Movimientos (Entrada, Salida, Traslado)
// ============================================================

/* ---- ENTRADA ---- */
function loadEntrada() {
    pageContent.innerHTML = `
        <!-- Se agrega 'overflow-visible' para evitar que el dropdown de autocompletado se corte al desplegarse -->
        <div class="card card-form-container overflow-visible">
            <div class="card-header">
                <span class="card-title">📥 Registro de Entrada</span>
            </div>
            <div class="card-body">
                <form id="entrada-form" novalidate>
                    <div class="form-group autocomplete-wrapper">
                        <label class="form-label" for="entrada-codigo">Código (Barra o Socofar)</label>
                        <div class="input-wrapper">
                            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M3 5h2M3 9h2M3 13h2M3 17h2M3 21h2M7 5v16M17 5v16M21 5h-2M21 9h-2M21 13h-2M21 17h-2M21 21h-2M11 5v16M13 5v16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <input type="text" id="entrada-codigo" class="form-input" placeholder="Escanea o escribe el código..." autocomplete="off" autofocus>
                        </div>
                        <div class="autocomplete-results" id="entrada-ac-results"></div>
                    </div>

                    <div class="form-group" id="producto-info" style="display:none">
                        <div class="info-alert-box">
                            <div class="text-xs text-muted">Producto identificado</div>
                            <div class="font-semibold mt-1" id="producto-nombre"></div>
                            <input type="hidden" id="entrada-producto-id" name="producto_id">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="entrada-lote">Número de Lote</label>
                        <div class="input-wrapper">
                            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            <input type="text" id="entrada-lote" name="numero_lote" class="form-input" placeholder="Ej: LOT-2024-001">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="entrada-vencimiento">Fecha de Vencimiento</label>
                        <input type="date" id="entrada-vencimiento" name="fecha_vencimiento" class="form-input">
                    </div>

                    <div class="form-group autocomplete-wrapper">
                        <label class="form-label" for="entrada-ubicacion-text">Ubicación</label>
                        <div class="input-wrapper">
                            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" stroke="currentColor" stroke-width="2"/>
                                <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            <input type="text" id="entrada-ubicacion-text" class="form-input" placeholder="Busca por código o descripción..." autocomplete="off">
                            <input type="hidden" id="entrada-ubicacion-id" name="ubicacion_id">
                        </div>
                        <div class="autocomplete-results" id="entrada-ubicacion-ac-results"></div>
                        <p class="form-hint">¿No existe la ubicación? <a href="?p=ubicaciones" class="text-primary font-semibold">Agrégala aquí</a></p>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="entrada-cantidad">Cantidad</label>
                        <div class="input-wrapper">
                            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="number" id="entrada-cantidad" name="cantidad" class="form-input" min="1" placeholder="0" inputmode="numeric">
                            <span class="input-suffix">unid.</span>
                        </div>
                    </div>

                    <div id="entrada-feedback"></div>

                    <div class="flex gap-3 mt-6">
                        <button type="submit" class="btn btn-success flex-1" id="entrada-submit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                            </svg>
                            Registrar Entrada
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="resetEntradaForm()">Limpiar</button>
                    </div>
                </form>
            </div>
        </div>`;

    initEntradaForm();
    document.getElementById('entrada-codigo')?.focus();
}

function initEntradaForm() {
    const codigoInput  = document.getElementById('entrada-codigo');
    const acResults    = document.getElementById('entrada-ac-results');
    const productoInfo = document.getElementById('producto-info');
    const productoNom  = document.getElementById('producto-nombre');
    const productoId   = document.getElementById('entrada-producto-id');
    
    const ubInput      = document.getElementById('entrada-ubicacion-text');
    const ubAcResults  = document.getElementById('entrada-ubicacion-ac-results');
    const ubId         = document.getElementById('entrada-ubicacion-id');

    let debounceTimer;

    codigoInput?.addEventListener('input', () => {
        const q = codigoInput.value.trim();
        clearTimeout(debounceTimer);
        if (q.length < 2) { acResults.classList.remove('visible'); return; }
        debounceTimer = setTimeout(async () => {
            try {
                const res  = await fetch(`api/productos.php?action=search&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                renderEntradaAutocomplete(data.results ?? []);
            } catch (e) { acResults.classList.remove('visible'); }
        }, 300);
    });

    function renderEntradaAutocomplete(results) {
        if (!results.length) { acResults.classList.remove('visible'); return; }
        acResults.innerHTML = results.map(r => `
            <div class="autocomplete-item" data-id="${r.id}" data-desc="${escapeHtml(r.descripcion)}" data-cod="${escapeHtml(r.cod_socofar)}">
                <div class="autocomplete-item-code">${escapeHtml(r.cod_socofar)}</div>
                <div class="autocomplete-item-desc">${escapeHtml(r.descripcion)}</div>
            </div>`).join('');
        acResults.classList.add('visible');

        acResults.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                codigoInput.value      = item.dataset.cod;
                productoId.value       = item.dataset.id;
                productoNom.textContent = item.dataset.desc;
                productoInfo.style.display = 'block';
                acResults.classList.remove('visible');
                document.getElementById('entrada-lote')?.focus();
            });
        });
    }

    ubInput?.addEventListener('input', () => {
        const q = ubInput.value.trim();
        clearTimeout(debounceTimer);
        if (q.length < 1) { ubAcResults.classList.remove('visible'); return; }
        debounceTimer = setTimeout(async () => {
            try {
                const res  = await fetch(`api/ubicaciones.php?action=list&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                renderUbicacionAutocomplete(data.rows ?? []);
            } catch (e) { ubAcResults.classList.remove('visible'); }
        }, 300);
    });

    function renderUbicacionAutocomplete(results) {
        if (!results.length) { ubAcResults.classList.remove('visible'); return; }
        ubAcResults.innerHTML = results.map(r => `
            <div class="autocomplete-item" data-id="${r.id}" data-codigo="${escapeHtml(r.codigo)}" data-desc="${escapeHtml(r.descripcion || '')}">
                <div class="autocomplete-item-code">${escapeHtml(r.codigo)}</div>
                <div class="autocomplete-item-desc">${escapeHtml(r.descripcion || '')}</div>
            </div>`).join('');
        ubAcResults.classList.add('visible');

        ubAcResults.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                ubInput.value      = `${item.dataset.codigo}${item.dataset.desc ? ' — ' + item.dataset.desc : ''}`;
                ubId.value         = item.dataset.id;
                ubAcResults.classList.remove('visible');
                document.getElementById('entrada-cantidad')?.focus();
            });
        });
    }

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) {
            acResults?.classList.remove('visible');
            ubAcResults?.classList.remove('visible');
        }
    });

    document.getElementById('entrada-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const feedback  = document.getElementById('entrada-feedback');
        const submitBtn = document.getElementById('entrada-submit');
        
        if (!productoId.value) {
            feedback.innerHTML = alertHTML('error', 'Selecciona un producto válido escaneando o eligiendo del listado.');
            feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }
        if (!ubId.value) {
            feedback.innerHTML = alertHTML('error', 'Selecciona una ubicación válida del listado de sugerencias.');
            feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        const payload = {
            producto_id:       productoId.value,
            numero_lote:       document.getElementById('entrada-lote').value.trim(),
            fecha_vencimiento: document.getElementById('entrada-vencimiento').value,
            ubicacion_id:      ubId.value,
            cantidad:          parseInt(document.getElementById('entrada-cantidad').value),
        };

        if (!payload.numero_lote) {
            feedback.innerHTML = alertHTML('error', 'El número de lote es obligatorio.');
            feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            document.getElementById('entrada-lote')?.focus();
            return;
        }
        if (!payload.fecha_vencimiento) {
            feedback.innerHTML = alertHTML('error', 'La fecha de vencimiento es obligatoria.');
            feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            document.getElementById('entrada-vencimiento')?.focus();
            return;
        }
        if (!payload.cantidad || payload.cantidad < 1) {
            feedback.innerHTML = alertHTML('error', 'La cantidad debe ser mayor a 0.');
            feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            document.getElementById('entrada-cantidad')?.focus();
            return;
        }

        submitBtn.disabled = true;
        feedback.innerHTML = '';
        try {
            const res  = await fetch('api/inventario.php?action=entrada', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.ok) {
                const nombreProducto = document.getElementById('producto-nombre')?.textContent ?? '—';
                const ubicacionTexto = document.getElementById('entrada-ubicacion-text')?.value ?? '—';
                
                feedback.innerHTML = `
                    <div class="alert alert-success">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <div>
                            ✅ Entrada registrada correctamente.
                            <div class="success-summary">
                                <strong>Producto:</strong> ${escapeHtml(nombreProducto)}<br>
                                <strong>Lote:</strong> ${escapeHtml(payload.numero_lote)} &mdash;
                                <strong>Vence:</strong> ${formatDate(payload.fecha_vencimiento)}<br>
                                <strong>Ubicación:</strong> ${escapeHtml(ubicacionTexto)}<br>
                                <strong>Cantidad:</strong> ${payload.cantidad} unidades
                            </div>
                        </div>
                    </div>`;

                feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                setTimeout(resetEntradaForm, 4000);
            } else {
                feedback.innerHTML = alertHTML('error', data.error ?? 'Error al registrar la entrada.');
                feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } catch (err) {
            feedback.innerHTML = alertHTML('error', 'Error de conexión con el servidor. Verifica tu red.');
            feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } finally {
            submitBtn.disabled = false;
        }
    });
}

function resetEntradaForm() {
    document.getElementById('entrada-form')?.reset();
    const info = document.getElementById('producto-info');
    if (info) info.style.display = 'none';
    const prodId = document.getElementById('entrada-producto-id');
    if (prodId) prodId.value = '';
    const ubId = document.getElementById('entrada-ubicacion-id');
    if (ubId) ubId.value = '';
    const feedback = document.getElementById('entrada-feedback');
    if (feedback) feedback.innerHTML = '';
    document.getElementById('entrada-codigo')?.focus();
}


/* ---- SALIDA ---- */
function loadSalida() {
    pageContent.innerHTML = `
        <!-- Se agrega 'overflow-visible' para evitar que el dropdown de autocompletado se corte al desplegarse -->
        <div class="card card-form-container overflow-visible">
            <div class="card-header">
                <span class="card-title">📤 Registro de Salida</span>
            </div>
            <div class="card-body">
                <form id="salida-form" novalidate>
                    <div class="form-group autocomplete-wrapper">
                        <label class="form-label" for="salida-codigo">Código (Barra o Socofar)</label>
                        <div class="input-wrapper">
                            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M3 5h2M3 9h2M3 13h2M3 17h2M3 21h2M7 5v16M17 5v16M21 5h-2M21 9h-2M21 13h-2M21 17h-2M21 21h-2M11 5v16M13 5v16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <input type="text" id="salida-codigo" class="form-input" placeholder="Escanea o escribe el código..." autocomplete="off" autofocus>
                        </div>
                        <div class="autocomplete-results" id="salida-ac-results"></div>
                    </div>

                    <div id="salida-ubicaciones-section" style="display:none">
                        <div class="form-group info-alert-box mb-6" id="salida-producto-info">
                            <div class="text-xs text-muted">Producto identificado</div>
                            <div class="font-semibold mt-1" id="salida-producto-nombre"></div>
                            <input type="hidden" id="salida-producto-id">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Selecciona Ubicación y Lote</label>
                            <div id="salida-lotes-lista" class="flex flex-col gap-2"></div>
                        </div>

                        <div class="form-group" id="salida-cantidad-section" style="display:none">
                            <label class="form-label" for="salida-cantidad">Cantidad a Descontar</label>
                            <div class="input-wrapper">
                                <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                                <input type="number" id="salida-cantidad" name="cantidad" class="form-input" min="1" placeholder="0" inputmode="numeric">
                                <span class="input-suffix">unid.</span>
                            </div>
                            <p class="form-hint" id="salida-stock-hint"></p>
                        </div>

                        <div id="salida-feedback"></div>

                        <div class="flex gap-3 mt-6">
                            <button type="submit" class="btn btn-danger flex-1" id="salida-submit" disabled>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                Registrar Salida
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="loadSalida()">Limpiar</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>`;

    initSalidaForm();
    document.getElementById('salida-codigo')?.focus();
}

function initSalidaForm() {
    const codigoInput  = document.getElementById('salida-codigo');
    const acResults    = document.getElementById('salida-ac-results');
    let debounceTimer;
    let selectedInventarioId = null;
    let selectedMaxCantidad  = 0;

    codigoInput?.addEventListener('input', () => {
        const q = codigoInput.value.trim();
        clearTimeout(debounceTimer);
        if (q.length < 2) { acResults.classList.remove('visible'); return; }
        debounceTimer = setTimeout(async () => {
            try {
                const res  = await fetch(`api/productos.php?action=search&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                renderSalidaAutocomplete(data.results ?? []);
            } catch (e) { acResults.classList.remove('visible'); }
        }, 300);
    });

    function renderSalidaAutocomplete(results) {
        if (!results.length) { acResults.classList.remove('visible'); return; }
        acResults.innerHTML = results.map(r => `
            <div class="autocomplete-item" data-id="${r.id}" data-desc="${escapeHtml(r.descripcion)}" data-cod="${escapeHtml(r.cod_socofar)}">
                <div class="autocomplete-item-code">${escapeHtml(r.cod_socofar)}</div>
                <div class="autocomplete-item-desc">${escapeHtml(r.descripcion)}</div>
            </div>`).join('');
        acResults.classList.add('visible');

        acResults.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', async () => {
                codigoInput.value = item.dataset.cod;
                acResults.classList.remove('visible');
                document.getElementById('salida-producto-nombre').textContent = item.dataset.desc;
                document.getElementById('salida-producto-id').value = item.dataset.id;
                document.getElementById('salida-ubicaciones-section').style.display = 'block';
                await loadSalidaLotes(item.dataset.id);
            });
        });
    }

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) acResults?.classList.remove('visible');
    });

    async function loadSalidaLotes(productoId) {
        const lista = document.getElementById('salida-lotes-lista');
        lista.innerHTML = '<div class="loading-spinner" style="padding:1rem">Buscando ubicaciones...</div>';
        try {
            const res  = await fetch(`api/inventario.php?action=stock_by_product&producto_id=${productoId}`);
            const data = await res.json();

            if (!data.rows || !data.rows.length) {
                lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><h3>Sin stock</h3><p>Este producto no tiene ubicaciones con stock disponible.</p></div>';
                return;
            }

            lista.innerHTML = data.rows.map(r => `
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

            lista.querySelectorAll('input[name="inventario_sel"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    selectedInventarioId = radio.value;
                    selectedMaxCantidad  = parseInt(radio.dataset.max);
                    document.getElementById('salida-cantidad-section').style.display = 'block';
                    document.getElementById('salida-stock-hint').textContent = `Disponible: ${selectedMaxCantidad} unidades.`;
                    document.getElementById('salida-submit').disabled = false;
                    document.getElementById('salida-cantidad').max = selectedMaxCantidad;
                    document.getElementById('salida-cantidad')?.focus();
                    
                    lista.querySelectorAll('.lote-row').forEach(l => l.style.borderColor = 'var(--border)');
                    radio.closest('.lote-row').style.borderColor = 'var(--primary)';
                });
            });
        } catch (e) {
            lista.innerHTML = alertHTML('error', 'Error al cargar el stock del producto.');
        }
    }

    document.getElementById('salida-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const feedback  = document.getElementById('salida-feedback');
        const submitBtn = document.getElementById('salida-submit');
        const cantidad  = parseInt(document.getElementById('salida-cantidad').value);

        if (!selectedInventarioId) { feedback.innerHTML = alertHTML('error', 'Selecciona una ubicación/lote.'); return; }
        if (!cantidad || cantidad < 1) { feedback.innerHTML = alertHTML('error', 'Ingresa una cantidad válida.'); return; }
        if (cantidad > selectedMaxCantidad) { feedback.innerHTML = alertHTML('error', `La cantidad no puede superar el stock disponible (${selectedMaxCantidad} unid.).`); return; }

        submitBtn.disabled = true;
        try {
            const res  = await fetch('api/inventario.php?action=salida', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inventario_id: selectedInventarioId, cantidad })
            });
            const data = await res.json();
            if (data.ok) {
                feedback.innerHTML = alertHTML('success', `✅ Salida registrada. ${data.eliminado ? 'La ubicación quedó sin stock y fue removida.' : `Stock restante: ${data.nuevo_stock} unidades.`}`);
                setTimeout(loadSalida, 2500);
            } else {
                feedback.innerHTML = alertHTML('error', data.error ?? 'Error al registrar la salida.');
            }
        } catch (err) {
            feedback.innerHTML = alertHTML('error', 'Error de conexión con el servidor.');
        } finally {
            submitBtn.disabled = false;
        }
    });
}


/* ---- TRASLADO ---- */
function loadTraslado() {
    pageContent.innerHTML = `
        <!-- Se agrega 'overflow-visible' para evitar que el dropdown de autocompletado se corte al desplegarse -->
        <div class="card card-form-container overflow-visible">
            <div class="card-header">
                <span class="card-title">🔄 Cambio de Ubicación</span>
            </div>
            <div class="card-body">
                <form id="traslado-form" novalidate>
                    <div class="traslado-flow-indicator mb-4" id="traslado-flow" style="display:none">
                        <div class="traslado-flow-node">
                            <span class="text-xs text-muted block mb-1">ORIGEN</span>
                            <strong id="flow-origen-val">—</strong>
                        </div>
                        <div class="traslado-flow-arrow text-primary flex-items-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="traslado-flow-node">
                            <span class="text-xs text-muted block mb-1">DESTINO</span>
                            <strong id="flow-destino-val">—</strong>
                        </div>
                    </div>

                    <div class="form-group autocomplete-wrapper">
                        <label class="form-label" for="traslado-codigo">Producto a Trasladar</label>
                        <div class="input-wrapper">
                            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            <input type="text" id="traslado-codigo" class="form-input" placeholder="Escanea o busca el producto..." autocomplete="off" autofocus>
                        </div>
                        <div class="autocomplete-results" id="traslado-ac-results"></div>
                    </div>

                    <div id="traslado-seccion-detalles" style="display:none">
                        <div class="form-group info-alert-box mb-6" id="traslado-producto-info">
                            <div class="text-xs text-muted">Producto identificado</div>
                            <div class="font-semibold mt-1" id="traslado-producto-nombre"></div>
                            <input type="hidden" id="traslado-producto-id">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Selecciona el Lote y Ubicación ORIGEN</label>
                            <div id="traslado-lotes-lista" class="flex flex-col gap-2"></div>
                        </div>

                        <div class="form-group autocomplete-wrapper" id="traslado-destino-wrapper" style="display:none">
                            <label class="form-label" for="traslado-destino">Ubicación de DESTINO</label>
                            <div class="input-wrapper">
                                <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" stroke="currentColor" stroke-width="2"/>
                                    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="2"/>
                                </svg>
                                <input type="text" id="traslado-destino" class="form-input" placeholder="Busca la nueva ubicación..." autocomplete="off">
                                <input type="hidden" id="traslado-destino-id">
                            </div>
                            <div class="autocomplete-results" id="traslado-destino-ac-results"></div>
                        </div>

                        <div class="form-group" id="traslado-cantidad-section" style="display:none">
                            <label class="form-label" for="traslado-cantidad">Cantidad a Trasladar</label>
                            <div class="input-wrapper">
                                <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <input type="number" id="traslado-cantidad" name="cantidad" class="form-input" min="1" placeholder="0" inputmode="numeric">
                                <span class="input-suffix">unid.</span>
                            </div>
                            <p class="form-hint" id="traslado-stock-hint"></p>
                        </div>

                        <div id="traslado-feedback"></div>

                        <div class="flex gap-3 mt-6">
                            <button type="submit" class="btn btn-primary flex-1" id="traslado-submit" disabled>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                                </svg>
                                Confirmar Traslado
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="loadTraslado()">Limpiar</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>`;

    initTrasladoForm();
    document.getElementById('traslado-codigo')?.focus();
}

function initTrasladoForm() {
    const codigoInput   = document.getElementById('traslado-codigo');
    const acResults     = document.getElementById('traslado-ac-results');
    const destinoInput  = document.getElementById('traslado-destino');
    const destAcResults = document.getElementById('traslado-destino-ac-results');
    
    let debounceTimer;
    let selectedInventarioId = null;
    let selectedMaxCantidad  = 0;
    let selectedDestinoId    = null;

    codigoInput?.addEventListener('input', () => {
        const q = codigoInput.value.trim();
        clearTimeout(debounceTimer);
        if (q.length < 2) { acResults.classList.remove('visible'); return; }
        debounceTimer = setTimeout(async () => {
            try {
                const res  = await fetch(`api/productos.php?action=search&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                renderTrasladoProdAc(data.results ?? []);
            } catch (e) { acResults.classList.remove('visible'); }
        }, 300);
    });

    function renderTrasladoProdAc(results) {
        if (!results.length) { acResults.classList.remove('visible'); return; }
        acResults.innerHTML = results.map(r => `
            <div class="autocomplete-item" data-id="${r.id}" data-desc="${escapeHtml(r.descripcion)}" data-cod="${escapeHtml(r.cod_socofar)}">
                <div class="autocomplete-item-code">${escapeHtml(r.cod_socofar)}</div>
                <div class="autocomplete-item-desc">${escapeHtml(r.descripcion)}</div>
            </div>`).join('');
        acResults.classList.add('visible');

        acResults.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', async () => {
                codigoInput.value = item.dataset.cod;
                acResults.classList.remove('visible');
                document.getElementById('traslado-producto-nombre').textContent = item.dataset.desc;
                document.getElementById('traslado-producto-id').value = item.dataset.id;
                document.getElementById('traslado-seccion-detalles').style.display = 'block';
                await loadTrasladoLotes(item.dataset.id);
            });
        });
    }

    async function loadTrasladoLotes(productoId) {
        const lista = document.getElementById('traslado-lotes-lista');
        lista.innerHTML = '<div class="loading-spinner" style="padding:1rem">Buscando stock...</div>';
        try {
            const res  = await fetch(`api/inventario.php?action=stock_by_product&producto_id=${productoId}`);
            const data = await res.json();

            if (!data.rows || !data.rows.length) {
                lista.innerHTML = '<div class="empty-state"><h3>Sin stock</h3><p>Este producto no tiene stock disponible para trasladar.</p></div>';
                return;
            }

            lista.innerHTML = data.rows.map(r => `
                <label class="lote-selection-card lote-row">
                    <input type="radio" name="traslado_inv_sel" value="${r.id}" data-max="${r.cantidad}" data-ubicacion="${escapeHtml(r.ubicacion_codigo)}" data-lote="${escapeHtml(r.numero_lote)}">
                    <div class="flex-1">
                        <div class="font-semibold text-sm">Lote: ${escapeHtml(r.numero_lote)}</div>
                        <div class="text-xs text-secondary">
                            Ubicación: <strong>${escapeHtml(r.ubicacion_codigo)}</strong> — 
                            Vence: <span class="badge badge-${expiryBadgeClass(r.fecha_vencimiento)}">${formatDate(r.fecha_vencimiento)}</span>
                        </div>
                    </div>
                    <span class="font-bold text-primary">${r.cantidad} <span class="font-normal text-xs text-muted">unid.</span></span>
                </label>`).join('');

            lista.querySelectorAll('input[name="traslado_inv_sel"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    selectedInventarioId = radio.value;
                    selectedMaxCantidad  = parseInt(radio.dataset.max);
                    
                    document.getElementById('traslado-destino-wrapper').style.display = 'block';
                    document.getElementById('traslado-whitespace-hack')?.remove(); // Cleanup old hack
                    document.getElementById('traslado-cantidad-section').style.display = 'block';
                    document.getElementById('traslado-stock-hint').textContent = `Disponible: ${selectedMaxCantidad} unidades.`;
                    
                    lista.querySelectorAll('.lote-row').forEach(l => l.style.borderColor = 'var(--border)');
                    radio.closest('.lote-row').style.borderColor = 'var(--primary)';
                    
                    updateFlow();
                    validateSubmit();
                });
            });
        } catch (e) {
            lista.innerHTML = alertHTML('error', 'Error al cargar el stock del producto.');
        }
    }

    destinoInput?.addEventListener('input', () => {
        const q = destinoInput.value.trim();
        clearTimeout(debounceTimer);
        if (q.length < 1) { destAcResults.classList.remove('visible'); return; }
        debounceTimer = setTimeout(async () => {
            try {
                const res  = await fetch(`api/ubicaciones.php?action=list&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                renderTrasladoDestAc(data.rows ?? []);
            } catch (e) { destAcResults.classList.remove('visible'); }
        }, 300);
    });

    function renderTrasladoDestAc(results) {
        if (!results.length) { destAcResults.classList.remove('visible'); return; }
        destAcResults.innerHTML = results.map(r => `
            <div class="autocomplete-item" data-id="${r.id}" data-cod="${escapeHtml(r.codigo)}">
                <div class="autocomplete-item-code">${escapeHtml(r.codigo)}</div>
                <div class="autocomplete-item-desc">${escapeHtml(r.descripcion ?? '')}</div>
            </div>`).join('');
        destAcResults.classList.add('visible');

        destAcResults.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                destinoInput.value = item.dataset.cod;
                selectedDestinoId  = item.dataset.id;
                destAcResults.classList.remove('visible');
                updateFlow();
                validateSubmit();
                document.getElementById('traslado-cantidad')?.focus();
            });
        });
    }

    function updateFlow() {
        const flow = document.getElementById('traslado-flow');
        const flowOrigenVal = document.getElementById('flow-origen-val');
        const flowDestinoVal = document.getElementById('flow-destino-val');
        
        flow.style.display = 'flex';
        
        const radio = document.querySelector('input[name="traslado_inv_sel"]:checked');
        if (radio) {
            flowOrigenVal.innerHTML = `${radio.dataset.ubicacion} <span class="text-xs text-muted block mb-1">Lote: ${radio.dataset.lote}</span>`;
        }
        
        if (selectedDestinoId) {
            flowDestinoVal.textContent = destinoInput.value;
        } else {
            flowDestinoVal.textContent = '—';
        }
    }

    function validateSubmit() {
        const submitBtn = document.getElementById('traslado-submit');
        submitBtn.disabled = !(selectedInventarioId && selectedDestinoId);
    }

    document.getElementById('traslado-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const feedback = document.getElementById('traslado-feedback');
        const submitBtn = document.getElementById('traslado-submit');
        const cantidad = parseInt(document.getElementById('traslado-cantidad').value);

        if (!selectedInventarioId || !selectedDestinoId) {
            feedback.innerHTML = alertHTML('error', 'Selecciona origen y destino.');
            return;
        }
        if (!cantidad || cantidad < 1) {
            feedback.innerHTML = alertHTML('error', 'Ingresa una cantidad válida.');
            return;
        }
        if (cantidad > selectedMaxCantidad) {
            feedback.innerHTML = alertHTML('error', `La cantidad supera el stock disponible (${selectedMaxCantidad} unid.).`);
            return;
        }

        submitBtn.disabled = true;
        try {
            const res = await fetch('api/inventario.php?action=traslado', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inventario_id: selectedInventarioId,
                    ubicacion_destino_id: selectedDestinoId,
                    cantidad: cantidad
                })
            });
            const data = await res.json();
            if (data.ok) {
                feedback.innerHTML = alertHTML('success', '✅ Traslado realizado con éxito.');
                showToast('Traslado completado');
                setTimeout(loadTraslado, 2000);
            } else {
                feedback.innerHTML = alertHTML('error', data.error ?? 'Error al realizar el traslado.');
            }
        } catch (err) {
            feedback.innerHTML = alertHTML('error', 'Error de conexión con el servidor.');
        } finally {
            submitBtn.disabled = false;
        }
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) {
            acResults?.classList.remove('visible');
            destAcResults?.classList.remove('visible');
        }
    });
}
