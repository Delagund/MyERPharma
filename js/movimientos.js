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
                        <button type="submit" class="btn btn-success flex-1" id="entrada-submit" disabled>
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
    const form         = document.getElementById('entrada-form');
    const submitBtn    = document.getElementById('entrada-submit');
    let productoTimer;
    let ubicacionTimer;
    let productoRevision = 0;
    let ubicacionRevision = 0;
    let enviando = false;

    function actualizarEnvio() {
        submitBtn.disabled = enviando || !productoId.value || !ubId.value;
    }

    function invalidarProducto() {
        clearTimeout(productoTimer);
        productoRevision++;
        productoId.value = '';
        productoNom.textContent = '';
        productoInfo.style.display = 'none';
        acResults.innerHTML = '';
        acResults.classList.remove('visible');
        actualizarEnvio();
        return productoRevision;
    }

    function invalidarUbicacion() {
        clearTimeout(ubicacionTimer);
        ubicacionRevision++;
        ubId.value = '';
        ubAcResults.innerHTML = '';
        ubAcResults.classList.remove('visible');
        actualizarEnvio();
        return ubicacionRevision;
    }

    function seleccionarProducto(producto) {
        invalidarProducto();
        codigoInput.value = producto.cod_socofar;
        productoId.value = producto.id;
        productoNom.textContent = producto.descripcion;
        productoInfo.style.display = 'block';
        actualizarEnvio();
    }

    // El escáner usa la misma selección y revisión que el autocompletado.
    form.entradaSeleccion = {
        invalidarProducto,
        seleccionarProducto,
        productoVigente: revision => form.isConnected && revision === productoRevision
    };
    form.addEventListener('reset', () => {
        invalidarProducto();
        invalidarUbicacion();
    });

    codigoInput?.addEventListener('input', () => {
        const revision = invalidarProducto();
        const q = codigoInput.value.trim();
        if (q.length < 2) return;
        productoTimer = setTimeout(async () => {
            try {
                const res  = await fetch(`api/productos.php?action=search&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                if (!form.entradaSeleccion.productoVigente(revision)) return;
                renderEntradaAutocomplete(data.results ?? []);
            } catch (e) {
                if (form.entradaSeleccion.productoVigente(revision)) acResults.classList.remove('visible');
            }
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
                seleccionarProducto({ id: item.dataset.id, cod_socofar: item.dataset.cod, descripcion: item.dataset.desc });
                document.getElementById('entrada-lote')?.focus();
            });
        });
    }

    ubInput?.addEventListener('input', () => {
        const revision = invalidarUbicacion();
        const q = ubInput.value.trim();
        if (q.length < 1) return;
        ubicacionTimer = setTimeout(async () => {
            try {
                const res  = await fetch(`api/ubicaciones.php?action=list&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                if (!form.isConnected || revision !== ubicacionRevision) return;
                renderUbicacionAutocomplete(data.rows ?? []);
            } catch (e) {
                if (form.isConnected && revision === ubicacionRevision) ubAcResults.classList.remove('visible');
            }
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
                invalidarUbicacion();
                ubInput.value      = `${item.dataset.codigo}${item.dataset.desc ? ' — ' + item.dataset.desc : ''}`;
                ubId.value         = item.dataset.id;
                actualizarEnvio();
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

    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (enviando) return;
        const feedback  = document.getElementById('entrada-feedback');
        
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

        enviando = true;
        form.dataset.enviando = 'true';
        actualizarEnvio();
        const nombreProducto = productoNom.textContent || '—';
        const ubicacionTexto = ubInput.value || '—';
        const controles = Array.from(form.querySelectorAll('input, select, textarea, button'))
            .map(control => [control, control.disabled]);
        controles.forEach(([control]) => control.disabled = true);
        feedback.innerHTML = '';
        try {
            const res  = await fetch('api/inventario.php?action=entrada', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, operacion_id: obtenerOperacionId(form, payload) })
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                olvidarOperacionId(form);
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
                form.reset();
            } else {
                feedback.innerHTML = alertHTML('error', data.error ?? 'Error al registrar la entrada.');
                feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } catch (err) {
            feedback.innerHTML = alertHTML('error', 'Error de conexión con el servidor. Verifica tu red.');
            feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } finally {
            enviando = false;
            delete form.dataset.enviando;
            controles.forEach(([control, disabled]) => control.disabled = disabled);
            actualizarEnvio();
        }
    });
}

function resetEntradaForm() {
    const form = document.getElementById('entrada-form');
    if (form) olvidarOperacionId(form);
    form?.reset();
    const feedback = document.getElementById('entrada-feedback');
    if (feedback) feedback.replaceChildren();
    document.getElementById('entrada-codigo')?.focus();
}

/* ---- SALIDA ---- */
let salidaEnCurso = false;

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
    let productoRevision = 0;

    salidaEnCurso = false;
    let salidaOperacionExitosa = false;

    const form = document.getElementById('salida-form');
    const feedback = document.getElementById('salida-feedback');
    const submitBtn = document.getElementById('salida-submit');

    feedback?.addEventListener('click', event => {
        if (event.target.closest('[data-action="nueva-salida"]')) loadSalida();
    });

    function invalidarProducto() {
        clearTimeout(debounceTimer);
        productoRevision++;
        document.getElementById('salida-producto-id').value = '';
        document.getElementById('salida-producto-nombre').textContent = '';
        document.getElementById('salida-lotes-lista').replaceChildren();
        document.getElementById('salida-ubicaciones-section').style.display = 'none';
        acResults.replaceChildren();
        acResults.classList.remove('visible');
        return productoRevision;
    }

    function productoVigente(revision) {
        return form.isConnected && revision === productoRevision;
    }

    async function seleccionarProducto(producto) {
        invalidarProducto();
        codigoInput.value = producto.cod_socofar;
        document.getElementById('salida-producto-nombre').textContent = producto.descripcion;
        document.getElementById('salida-producto-id').value = producto.id;
        document.getElementById('salida-ubicaciones-section').style.display = 'block';
        return loadSalidaLotes(producto.id, productoRevision);
    }

    form.salidaSeleccion = { invalidarProducto, productoVigente, seleccionarProducto };

    codigoInput?.addEventListener('input', () => {
        const q = codigoInput.value.trim();
        const revision = invalidarProducto();
        feedback.replaceChildren();
        if (q.length < 2) { acResults.classList.remove('visible'); return; }
        debounceTimer = setTimeout(async () => {
            try {
                const res  = await fetch(`api/productos.php?action=search&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                if (!productoVigente(revision) || !res.ok) return;
                renderSalidaAutocomplete(data.results ?? []);
            } catch (e) { if (productoVigente(revision)) acResults.classList.remove('visible'); }
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
                feedback.replaceChildren();
                await seleccionarProducto({ id: item.dataset.id, cod_socofar: item.dataset.cod, descripcion: item.dataset.desc });
            });
        });
    }

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) acResults?.classList.remove('visible');
    });

    document.getElementById('salida-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        if (salidaEnCurso) return;

        const checkedCbs = Array.from(document.querySelectorAll('input[name="inv_sel"]:checked'));
        if (!checkedCbs.length) {
            feedback.innerHTML = alertHTML('error', 'Selecciona al menos una ubicación.');
            return;
        }

        const operaciones = [];
        for (const cb of checkedCbs) {
            const invId = parseInt(cb.value);
            const max = parseInt(cb.dataset.max);
            const cantInput = cb.closest('.lote-row')?.querySelector('.lote-cantidad');
            const cantidad = cantInput ? parseInt(cantInput.value) : 0;

            if (!cantidad || cantidad < 1 || cantidad > max) {
                feedback.innerHTML = alertHTML('error', `La cantidad a descontar debe ser mayor a 0 y no superar el máximo disponible (${max} unid.).`);
                if (cantInput) cantInput.focus();
                return;
            }

            operaciones.push({ inventario_id: invId, cantidad: cantidad });
        }

        const productoIdEl = document.getElementById('salida-producto-id');
        const productoId = productoIdEl ? parseInt(productoIdEl.value) : 0;
        const nombreProducto = document.getElementById('salida-producto-nombre').textContent;
        const controles = Array.from(form.querySelectorAll('input, select, textarea, button'))
            .map(control => [control, control.disabled]);

        salidaEnCurso = true;
        salidaOperacionExitosa = false;
        controles.forEach(([control]) => control.disabled = true);
        submitBtn.textContent = `Procesando ${operaciones.length} ubicación(es)...`;

        try {
            const res = await fetch('api/inventario.php?action=salida_multi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ producto_id: productoId, operaciones, operacion_id: obtenerOperacionId(form, { producto_id: productoId, operaciones }) })
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                salidaOperacionExitosa = true;
                olvidarOperacionId(form);
                document.getElementById('salida-lotes-lista').replaceChildren();
                document.getElementById('salida-producto-id').value = '';
                document.getElementById('salida-producto-nombre').textContent = '';
                codigoInput.value = '';
                acResults.replaceChildren();
                acResults.classList.remove('visible');
                feedback.innerHTML = `${alertHTML('success', `✅ Salida registrada para ${escapeHtml(nombreProducto)} (${operaciones.length} ubicación(es) procesada(s)).`)}<button type="button" class="btn btn-secondary mt-3" data-action="nueva-salida">Nueva salida</button>`;
                submitBtn.disabled = true;
                feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                feedback.innerHTML = alertHTML('error', data.error ?? 'Error al registrar la salida.');
                if (!res.ok && res.status >= 500) throw new Error('resultado_incierto');
            }
        } catch (err) {
            salidaOperacionExitosa = false;
            document.getElementById('salida-lotes-lista').replaceChildren();
            document.getElementById('salida-producto-id').value = '';
            document.getElementById('salida-producto-nombre').textContent = '';
            codigoInput.value = '';
            acResults.replaceChildren();
            acResults.classList.remove('visible');
            feedback.innerHTML = alertHTML('error', 'No se pudo confirmar el resultado. Busca nuevamente el producto antes de intentar otra salida.');
        } finally {
            salidaEnCurso = false;
            submitBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Registrar Salida`;
            controles.forEach(([control, disabled]) => control.disabled = disabled);
            if (salidaOperacionExitosa) {
                submitBtn.disabled = true;
            } else {
                form.querySelectorAll('input[name="inv_sel"]').forEach(cb => {
                    cb.disabled = false;
                    const cantInput = cb.closest('.lote-row')?.querySelector('.lote-cantidad');
                    if (cantInput) cantInput.disabled = !cb.checked;
                });
                submitBtn.disabled = form.querySelectorAll('input[name="inv_sel"]:checked').length === 0;
            }
        }
    });
}

async function loadSalidaLotes(productoId, revision = null) {
    const lista = document.getElementById('salida-lotes-lista');
    if (revision !== null && !document.getElementById('salida-form')?.salidaSeleccion.productoVigente(revision)) return null;
    lista.innerHTML = '<div class="loading-spinner" style="padding:1rem">Buscando ubicaciones...</div>';
    try {
        const res  = await fetch(`api/inventario.php?action=stock_by_product&producto_id=${productoId}`);
        const data = await res.json();

        if (revision !== null && !document.getElementById('salida-form')?.salidaSeleccion.productoVigente(revision)) return null;
        if (!res.ok) throw new Error('No se pudo cargar el stock.');

        if (!data.rows || !data.rows.length) {
            lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><h3>Sin stock</h3><p>Este producto no tiene ubicaciones con stock disponible.</p></div>';
            return 0;
        }

        lista.innerHTML = data.rows.map(r => `
            <label class="lote-selection-card lote-row flex items-center justify-between gap-3 p-3 border rounded mb-2">
                <div class="flex items-center gap-3 flex-1">
                    <input type="checkbox" name="inv_sel" value="${r.id}" data-max="${r.cantidad}">
                    <div>
                        <div class="font-semibold text-sm">Lote: ${escapeHtml(r.numero_lote)}</div>
                        <div class="text-xs text-secondary">
                            Ubicación: <strong>${escapeHtml(r.ubicacion_codigo)}</strong> — 
                            Vence: <span class="badge badge-${expiryBadgeClass(r.fecha_vencimiento)}">${formatDate(r.fecha_vencimiento)}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-primary">${r.cantidad} <span class="font-normal text-xs text-muted">unid.</span></span>
                    <input type="number" class="lote-cantidad form-input" min="1" max="${r.cantidad}" value="" placeholder="Cant." disabled style="width:90px">
                </div>
            </label>`).join('');

        lista.querySelectorAll('input[name="inv_sel"]').forEach(cb => {
            const row = cb.closest('.lote-row');
            const cantInput = row ? row.querySelector('.lote-cantidad') : null;

            if (cantInput) {
                cantInput.addEventListener('click', e => e.stopPropagation());
            }

            cb.addEventListener('change', () => {
                if (cb.checked) {
                    if (cantInput) {
                        cantInput.disabled = false;
                        if (!cantInput.value) {
                            cantInput.value = 1;
                        }
                        cantInput.focus();
                    }
                    if (row) row.style.borderColor = 'var(--primary)';
                } else {
                    if (cantInput) {
                        cantInput.disabled = true;
                        cantInput.value = '';
                    }
                    if (row) row.style.borderColor = 'var(--border)';
                }

                const checkedCount = lista.querySelectorAll('input[name="inv_sel"]:checked').length;
                const submitBtn = document.getElementById('salida-submit');
                if (submitBtn) {
                    submitBtn.disabled = (checkedCount === 0);
                }
            });
        });

        if (data.rows.length === 1) {
            const cb = lista.querySelector('input[name="inv_sel"]');
            if (cb) {
                cb.checked = true;
                cb.dispatchEvent(new Event('change'));
            }
        }

        return data.rows.length;
    } catch (e) {
        if (revision !== null && !document.getElementById('salida-form')?.salidaSeleccion.productoVigente(revision)) return null;
        lista.innerHTML = alertHTML('error', 'Error al cargar el stock del producto.');
        return 0;
    }
}


/* ---- TRASLADO ---- */
let trasladoInventarioId = null;
let trasladoMaxCantidad  = 0;
let trasladoDestinoId    = null;
let trasladoEnCurso = false;
let trasladoUbicacionEnCurso = false;

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
                            <strong id="flow-origen-val"><span id="flow-origen-ubicacion">—</span> <span id="flow-origen-lote" class="text-xs text-muted block mb-1"></span></strong>
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
                    <div id="traslado-status" class="mt-4" role="status" aria-live="polite"></div>
                </form>
            </div>
        </div>`;

    pageContent.insertAdjacentHTML('beforeend', `
        <section class="card card-form-container traslado-ubicacion-card mt-6" aria-labelledby="traslado-ubicacion-titulo">
            <div class="card-header"><h2 class="card-title" id="traslado-ubicacion-titulo">Mover ubicación completa</h2></div>
            <div class="card-body">
                <p class="form-hint mb-4">Revisa todos los productos y lotes del origen antes de moverlos al destino.</p>
                <form id="traslado-ubicacion-form">
                    <div class="form-group">
                        <label class="form-label" for="traslado-ubicacion-origen">Ubicación de origen</label>
                        <select id="traslado-ubicacion-origen" class="form-select" required disabled><option value="">Cargando ubicaciones...</option></select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="traslado-ubicacion-destino">Ubicación de destino</label>
                        <select id="traslado-ubicacion-destino" class="form-select" required disabled><option value="">Cargando ubicaciones...</option></select>
                    </div>
                    <div id="traslado-ubicacion-feedback" role="status" aria-live="polite"></div>
                    <div id="traslado-ubicacion-revision"></div>
                    <div class="flex gap-3 mt-6 traslado-ubicacion-actions">
                        <button type="button" class="btn btn-secondary" id="traslado-ubicacion-revisar" disabled>Revisar contenido</button>
                        <button type="submit" class="btn btn-primary" id="traslado-ubicacion-confirmar" disabled>Confirmar traslado completo</button>
                        <button type="button" class="btn btn-secondary" id="traslado-ubicacion-limpiar" disabled>Limpiar</button>
                    </div>
                </form>
            </div>
        </section>`);
    initTrasladoForm();
    initTrasladoUbicacionForm();
    document.getElementById('traslado-codigo')?.focus();
}

let trasladoRevision = 0;

function productoTrasladoVigente(token) {
    return token.revision === trasladoRevision && token.form === document.getElementById('traslado-form');
}

function invalidarProductoTraslado() {
    trasladoRevision++;
    trasladoInventarioId = null;
    trasladoMaxCantidad = 0;
    trasladoDestinoId = null;
    for (const id of ['traslado-producto-id', 'traslado-destino', 'traslado-destino-id', 'traslado-cantidad']) {
        document.getElementById(id).value = '';
    }
    for (const id of ['traslado-producto-nombre', 'traslado-lotes-lista', 'traslado-stock-hint', 'traslado-feedback', 'flow-origen-lote']) {
        document.getElementById(id).textContent = '';
    }
    for (const id of ['traslado-seccion-detalles', 'traslado-destino-wrapper', 'traslado-cantidad-section', 'traslado-flow']) {
        document.getElementById(id).style.display = 'none';
    }
    for (const id of ['traslado-ac-results', 'traslado-destino-ac-results']) {
        document.getElementById(id).replaceChildren();
        document.getElementById(id).classList.remove('visible');
    }
    document.getElementById('flow-origen-ubicacion').textContent = '—';
    document.getElementById('flow-destino-val').textContent = '—';
    validateSubmit();
    return { revision: trasladoRevision, form: document.getElementById('traslado-form') };
}

async function seleccionarProductoTraslado(producto) {
    const token = invalidarProductoTraslado();
    document.getElementById('traslado-codigo').value = producto.cod_socofar;
    document.getElementById('traslado-producto-nombre').textContent = producto.descripcion;
    document.getElementById('traslado-producto-id').value = producto.id;
    document.getElementById('traslado-seccion-detalles').style.display = 'block';
    return loadTrasladoLotes(producto.id, token);
}

function initTrasladoForm() {
    const codigoInput   = document.getElementById('traslado-codigo');
    const acResults     = document.getElementById('traslado-ac-results');
    const destinoInput  = document.getElementById('traslado-destino');
    const destAcResults = document.getElementById('traslado-destino-ac-results');
    const form = document.getElementById('traslado-form');
    const status = document.getElementById('traslado-status');
    
    let debounceTimer;
    let destinoTimer;
    let destinoRevision = 0;
    trasladoEnCurso = false;
    invalidarProductoTraslado();

    form.addEventListener('click', event => {
        if (event.target.closest('[data-action="nuevo-traslado"]')) {
            status.replaceChildren();
            codigoInput.focus();
        }
    });

    codigoInput?.addEventListener('input', () => {
        const q = codigoInput.value.trim();
        status.replaceChildren();
        const token = invalidarProductoTraslado();
        clearTimeout(debounceTimer);
        if (q.length < 2) { acResults.classList.remove('visible'); return; }
        debounceTimer = setTimeout(async () => {
            try {
                const res  = await fetch(`api/productos.php?action=search&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                if (!productoTrasladoVigente(token)) return;
                renderTrasladoProdAc(data.results ?? []);
            } catch (e) { if (productoTrasladoVigente(token)) acResults.classList.remove('visible'); }
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
                await seleccionarProductoTraslado({ id: item.dataset.id, cod_socofar: item.dataset.cod, descripcion: item.dataset.desc });
            });
        });
    }

    destinoInput?.addEventListener('input', () => {
        const q = destinoInput.value.trim();
        const revision = ++destinoRevision;
        const token = { revision: trasladoRevision, form: document.getElementById('traslado-form') };
        trasladoDestinoId = null;
        document.getElementById('traslado-destino-id').value = '';
        destAcResults.replaceChildren();
        destAcResults.classList.remove('visible');
        updateFlow();
        validateSubmit();
        clearTimeout(destinoTimer);
        if (q.length < 1) { destAcResults.classList.remove('visible'); return; }
        destinoTimer = setTimeout(async () => {
            try {
                const res  = await fetch(`api/ubicaciones.php?action=list&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                if (revision !== destinoRevision || !productoTrasladoVigente(token)) return;
                renderTrasladoDestAc(data.rows ?? []);
            } catch (e) { if (revision === destinoRevision && productoTrasladoVigente(token)) destAcResults.classList.remove('visible'); }
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
                trasladoDestinoId  = item.dataset.id;
                document.getElementById('traslado-destino-id').value = item.dataset.id;
                destAcResults.classList.remove('visible');
                updateFlow();
                validateSubmit();
                document.getElementById('traslado-cantidad')?.focus();
            });
        });
    }

    form?.addEventListener('submit', async e => {
        e.preventDefault();
        const feedback = document.getElementById('traslado-feedback');
        const submitBtn = document.getElementById('traslado-submit');
        const cantidad = parseInt(document.getElementById('traslado-cantidad').value);
        const productoId = document.getElementById('traslado-producto-id').value;

        if (!productoId || !trasladoInventarioId || !trasladoDestinoId) {
            feedback.innerHTML = alertHTML('error', 'Selecciona origen y destino.');
            return;
        }
        if (!cantidad || cantidad < 1) {
            feedback.innerHTML = alertHTML('error', 'Ingresa una cantidad válida.');
            return;
        }
        if (cantidad > trasladoMaxCantidad) {
            feedback.innerHTML = alertHTML('error', `La cantidad supera el stock disponible (${trasladoMaxCantidad} unid.).`);
            return;
        }

        const payload = {
            producto_id: productoId,
            inventario_id: trasladoInventarioId,
            ubicacion_destino_id: trasladoDestinoId,
            cantidad
        };
        const controles = Array.from(form.querySelectorAll('input, select, textarea, button'))
            .map(control => [control, control.disabled]);
        trasladoEnCurso = true;
        controles.forEach(([control]) => control.disabled = true);
        feedback.innerHTML = '';
        try {
            const res = await fetch('api/inventario.php?action=traslado', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, operacion_id: obtenerOperacionId(form, payload) })
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                olvidarOperacionId(form);
                invalidarProductoTraslado();
                codigoInput.value = '';
                status.innerHTML = `${alertHTML('success', `✅ Traslado realizado con éxito: ${payload.cantidad} unidades.`)}<button type="button" class="btn btn-secondary mt-3" data-action="nuevo-traslado">Nuevo traslado</button>`;
                status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                showToast('Traslado completado');
            } else {
                feedback.innerHTML = alertHTML('error', data.error ?? 'Error al realizar el traslado.');
                if (!res.ok && res.status >= 500) throw new Error('resultado_incierto');
            }
        } catch (err) {
            invalidarProductoTraslado();
            codigoInput.value = '';
            status.innerHTML = `${alertHTML('error', 'No se pudo confirmar el resultado. Busca nuevamente el producto y revisa su stock antes de intentar otra vez.')}<button type="button" class="btn btn-secondary mt-3" data-action="nuevo-traslado">Consultar nuevamente</button>`;
            status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } finally {
            trasladoEnCurso = false;
            controles.forEach(([control, disabled]) => control.disabled = disabled);
            validateSubmit();
        }
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) {
            acResults?.classList.remove('visible');
            destAcResults?.classList.remove('visible');
        }
    });
}

async function loadTrasladoLotes(productoId, token = { revision: trasladoRevision, form: document.getElementById('traslado-form') }) {
    const lista = document.getElementById('traslado-lotes-lista');
    lista.innerHTML = '<div class="loading-spinner" style="padding:1rem">Buscando stock...</div>';
    try {
        const res  = await fetch(`api/inventario.php?action=stock_by_product&producto_id=${productoId}`);
        const data = await res.json();

        if (!productoTrasladoVigente(token)) return null;
        if (!res.ok || data.ok === false) throw new Error(data.error || 'No se pudo cargar el stock.');

        if (!data.rows || !data.rows.length) {
            lista.innerHTML = '<div class="empty-state"><h3>Sin stock</h3><p>Este producto no tiene stock disponible para trasladar.</p></div>';
            return 0;
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
                trasladoInventarioId = radio.value;
                trasladoMaxCantidad  = parseInt(radio.dataset.max);
                document.getElementById('traslado-destino').value = '';
                document.getElementById('traslado-destino').dispatchEvent(new Event('input'));
                document.getElementById('traslado-cantidad').value = '';

                document.getElementById('traslado-destino-wrapper').style.display = 'block';
                document.getElementById('traslado-whitespace-hack')?.remove(); // Cleanup old hack
                document.getElementById('traslado-cantidad-section').style.display = 'block';
                document.getElementById('traslado-stock-hint').textContent = `Disponible: ${trasladoMaxCantidad} unidades.`;

                lista.querySelectorAll('.lote-row').forEach(l => l.style.borderColor = 'var(--border)');
                radio.closest('.lote-row').style.borderColor = 'var(--primary)';

                updateFlow();
                validateSubmit();
            });
        });

        if (data.rows.length === 1) {
            const radio = lista.querySelector('input[name="traslado_inv_sel"]');
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
        }

        return data.rows.length;
    } catch (e) {
        if (!productoTrasladoVigente(token)) return null;
        lista.innerHTML = alertHTML('error', 'Error al cargar el stock del producto.');
        return 0;
    }
}

function updateFlow() {
    const flow = document.getElementById('traslado-flow');
    const flowOrigenUbicacion = document.getElementById('flow-origen-ubicacion');
    const flowOrigenLote = document.getElementById('flow-origen-lote');
    const flowDestinoVal = document.getElementById('flow-destino-val');

    flow.style.display = 'flex';

    const radio = document.querySelector('input[name="traslado_inv_sel"]:checked');
    if (radio) {
        flowOrigenUbicacion.textContent = radio.dataset.ubicacion;
        flowOrigenLote.textContent = `Lote: ${radio.dataset.lote}`;
    }

    if (trasladoDestinoId) {
        flowDestinoVal.textContent = document.getElementById('traslado-destino').value;
    } else {
        flowDestinoVal.textContent = '—';
    }
}

function validateSubmit() {
    const submitBtn = document.getElementById('traslado-submit');
    submitBtn.disabled = trasladoEnCurso || !(document.getElementById('traslado-producto-id').value && trasladoInventarioId && trasladoDestinoId);
}

async function initTrasladoUbicacionForm() {
    const form = document.getElementById('traslado-ubicacion-form');
    const origen = document.getElementById('traslado-ubicacion-origen');
    const destino = document.getElementById('traslado-ubicacion-destino');
    const revisar = document.getElementById('traslado-ubicacion-revisar');
    const confirmar = document.getElementById('traslado-ubicacion-confirmar');
    const limpiar = document.getElementById('traslado-ubicacion-limpiar');
    const revision = document.getElementById('traslado-ubicacion-revision');
    const feedback = document.getElementById('traslado-ubicacion-feedback');
    let snapshot = null;
    let enCurso = false;
    trasladoUbicacionEnCurso = false;

    function actualizarControles() {
        const valido = origen.value && destino.value && origen.value !== destino.value;
        origen.disabled = destino.disabled = limpiar.disabled = enCurso;
        revisar.disabled = enCurso || !valido;
        confirmar.disabled = enCurso || !valido || !snapshot;
        form.setAttribute('aria-busy', String(enCurso));
        Array.from(destino.options).forEach(opt => { opt.disabled = !!opt.value && opt.value === origen.value; });
    }
    function invalidarRevision() {
        snapshot = null;
        revision.innerHTML = '';
        feedback.innerHTML = '';
        actualizarControles();
    }
    origen.addEventListener('change', () => {
        if (origen.value === destino.value) destino.value = '';
        invalidarRevision();
    });
    destino.addEventListener('change', invalidarRevision);
    limpiar.addEventListener('click', () => { form.reset(); invalidarRevision(); origen.focus(); });

    revisar.addEventListener('click', async () => {
        if (enCurso || revisar.disabled) return;
        invalidarRevision();
        enCurso = true;
        revisar.textContent = 'Consultando...';
        actualizarControles();
        try {
            const res = await fetch(`api/inventario.php?action=stock_by_location&ubicacion_id=${encodeURIComponent(origen.value)}`);
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo consultar el contenido.');
            if (!form.isConnected) return;
            if (!data.rows.length) {
                feedback.innerHTML = alertHTML('info', 'El origen no tiene stock para trasladar.');
                return;
            }
            revision.innerHTML = renderRevisionTrasladoUbicacion(data);
            snapshot = data.snapshot_hash;
            feedback.innerHTML = alertHTML('info', `Se moverán ${data.total_unidades} unidades de ${origen.selectedOptions[0].textContent} a ${destino.selectedOptions[0].textContent}. Si cambia el stock, tendrás que revisarlo nuevamente.`);
        } catch (err) {
            feedback.innerHTML = alertHTML('error', err.message || 'Error de conexión. Vuelve a revisar el contenido.');
        } finally {
            enCurso = false;
            revisar.textContent = 'Revisar contenido';
            actualizarControles();
        }
    });
    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (enCurso || confirmar.disabled || !snapshot) return;
        enCurso = true;
        trasladoUbicacionEnCurso = true;
        actualizarControles();
        confirmar.textContent = 'Trasladando...';
        const payload = { ubicacion_origen_id: Number(origen.value), ubicacion_destino_id: Number(destino.value), snapshot_hash: snapshot };
        try {
            const res = await fetch('api/inventario.php?action=traslado_ubicacion', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, operacion_id: obtenerOperacionId(form, payload) })
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo realizar el traslado.');
            olvidarOperacionId(form);
            form.reset();
            feedback.innerHTML = alertHTML('success', `Traslado completado: ${data.unidades_trasladadas} unidades en ${data.registros_trasladados} registros.`);
            showToast('Ubicación trasladada');
        } catch (err) {
            feedback.innerHTML = alertHTML('error', err.message || 'No se pudo confirmar el resultado. Revisa el stock antes de volver a intentarlo.');
        } finally {
            // Un resultado incierto nunca permite reenviar una revisión anterior.
            snapshot = null;
            revision.innerHTML = '';
            enCurso = false;
            trasladoUbicacionEnCurso = false;
            confirmar.textContent = 'Confirmar traslado completo';
            actualizarControles();
        }
    });

    try {
        const ubicaciones = [];
        let page = 1;
        let totalPages = 1;
        do {
            const res = await fetch(`api/ubicaciones.php?action=list&page=${page}`);
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar las ubicaciones.');
            ubicaciones.push(...data.rows.filter(row => Number(row.id) !== 1));
            totalPages = Number(data.total_pages);
            page++;
        } while (page <= totalPages);
        if (!form.isConnected) return;
        for (const select of [origen, destino]) {
            select.innerHTML = '<option value="">Selecciona una ubicación</option>';
            ubicaciones.forEach(row => select.add(new Option(`${row.codigo}${row.descripcion ? ' — ' + row.descripcion : ''}`, row.id)));
        }
        actualizarControles();
    } catch (err) {
        feedback.innerHTML = alertHTML('error', `${err.message} Recarga la página para volver a intentarlo.`);
    }
}

function renderRevisionTrasladoUbicacion(data) {
    return `<p class="font-semibold mb-4">${data.total_registros} registros · ${data.total_unidades} unidades</p>
        <div class="traslado-stock-scroll" tabindex="0" role="region" aria-label="Contenido de la ubicación de origen">
            <table class="traslado-stock-table">
                <caption class="text-secondary">Contenido revisado para el traslado completo</caption>
                <thead><tr><th scope="col">Producto</th><th scope="col">Lote</th><th scope="col">Vencimiento</th><th scope="col">Unidades</th></tr></thead>
                <tbody>${data.rows.map(row => `<tr><td>${escapeHtml(row.descripcion)}<br><small>${escapeHtml(row.cod_socofar)}</small></td>
                    <td>${escapeHtml(row.numero_lote)}</td><td>${formatDate(row.fecha_vencimiento)}</td><td>${Number(row.cantidad)}</td></tr>`).join('')}</tbody>
            </table>
        </div>`;
}
