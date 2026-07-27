// ==========================================
// ESTADO DE LA APLICACIÓN
// ==========================================
const state = {
    modelo: null,
    acabado: null,
    alturaModulo: 0,
    alturaDescuento: 2,
    alturaReal: 0,
    alturaValido: null,
    anchoModulo: 0,
    anchoDescuento: 2,
    anchoReal: 0,
    anchoValido: null,
    cantidad: 1,
    bisagrasNominal: 0,
    bisagrasExtras: 0,
    bisagrasTotal: 0,
    bisagrasMaxTecnico: 0,
    bisagrasB1: 100,
    bisagrasB2: 100,
    bisagrasCalculadas: 0,
    bisagras: '',
    tirador: false,
    tiradorTipo: null,
    vidrioMontado: false,
    colorVidrio: '',
    vidrioAlto: 0,
    vidrioAncho: 0
};

// Límite duro de fabricación del vidrio (mm)
const VIDRIO_MAX_ALTO = 2800;

// ==========================================
// ELEMENTOS DOM
// ==========================================
const elementos = {
    modelos: document.querySelectorAll('.modelo-card'),
    acabados: document.querySelectorAll('.acabado-item'),
    alturaModulo: document.getElementById('alturaModulo'),
    alturaDescuento: document.getElementById('alturaDescuento'),
    alturaReal: document.getElementById('alturaReal'),
    alturaMensaje: document.getElementById('alturaMensaje'),
    anchoModulo: document.getElementById('anchoModulo'),
    anchoDescuento: document.getElementById('anchoDescuento'),
    anchoReal: document.getElementById('anchoReal'),
    anchoMensaje: document.getElementById('anchoMensaje'),
    cantidad: document.getElementById('cantidad'),
    bisagrasWidget: document.getElementById('bisagrasWidget'),
    bisagrasNominalInfo: document.getElementById('bisagrasNominalInfo'),
    bisagrasNum: document.getElementById('bisagrasNum'),
    bisagrasMenos: document.getElementById('bisagrasMenos'),
    bisagrasmas: document.getElementById('bisagrasmas'),
    bisagrasExtraPrecio: document.getElementById('bisagrasExtraPrecio'),
    bisagrasAdvertencia: document.getElementById('bisagrasAdvertencia'),
    tirador: document.getElementById('tirador'),
    tiradoresSelector: document.getElementById('tiradoresSelector'),
    tiradoresCards: document.querySelectorAll('.tirador-card'),
    vidrioMontado: document.getElementById('vidrioMontado'),
    colorVidrio: document.getElementById('colorVidrio'),
    colorVidrioLabel: document.getElementById('colorVidrioLabel'),
    resumenModelo: document.getElementById('resumenModelo'),
    resumenAcabado: document.getElementById('resumenAcabado'),
    resumenDimensiones: document.getElementById('resumenDimensiones'),
    resumenVidrioMedidas: document.getElementById('resumenVidrioMedidas'),
    resumenCantidad: document.getElementById('resumenCantidad'),
    resumenBisagras: document.getElementById('resumenBisagras'),
    resumenBisagrasExtra: document.getElementById('resumenBisagrasExtra'),
    resumenTirador: document.getElementById('resumenTirador'),
    resumenVidrio: document.getElementById('resumenVidrio'),
    btnCalcular: document.getElementById('btnCalcular'),
    btnFabricar: document.getElementById('btnFabricar'),
    btnReset: document.getElementById('btnReset')
};

// ==========================================
// INICIALIZACIÓN
// ==========================================
function init() {
    console.log('Inicializando aplicación...');

    // Nombres de acabado desde CONFIG (única fuente de verdad; el texto del HTML es solo fallback)
    elementos.acabados.forEach(item => {
        const cfg = CONFIG.acabados[item.dataset.acabado];
        const nombreEl = item.querySelector('.acabado-nombre');
        if (cfg && nombreEl) nombreEl.textContent = cfg.nombre;
    });

    elementos.modelos.forEach(card => {
        card.addEventListener('click', () => seleccionarModelo(card));
    });

    elementos.acabados.forEach(item => {
        item.addEventListener('click', () => seleccionarAcabado(item));
    });

    elementos.alturaModulo?.addEventListener('blur', () => calcularMedida('altura', 'modulo'));
    elementos.alturaDescuento?.addEventListener('blur', () => calcularMedida('altura', 'descuento'));
    elementos.alturaReal?.addEventListener('blur', () => calcularMedida('altura', 'real'));
    elementos.anchoModulo?.addEventListener('blur', () => calcularMedida('ancho', 'modulo'));
    elementos.anchoDescuento?.addEventListener('blur', () => calcularMedida('ancho', 'descuento'));
    elementos.anchoReal?.addEventListener('blur', () => calcularMedida('ancho', 'real'));

    elementos.cantidad?.addEventListener('change', actualizarCantidad);
    elementos.bisagrasMenos?.addEventListener('click', () => cambiarBisagrasExtra(-1));
    elementos.bisagrasmas?.addEventListener('click', () => cambiarBisagrasExtra(+1));
    elementos.tirador?.addEventListener('change', actualizarTirador);

    elementos.tiradoresCards.forEach(card => {
        card.addEventListener('click', () => seleccionarTirador(card));
    });

    elementos.vidrioMontado?.addEventListener('change', actualizarVidrio);
    elementos.colorVidrio?.addEventListener('change', actualizarColorVidrio);

    elementos.btnCalcular?.addEventListener('click', calcularPresupuesto);
    elementos.btnFabricar?.addEventListener('click', pasarAFabricacion);
    elementos.btnReset?.addEventListener('click', resetearDatos);

    actualizarPreciosInterfaz();
    actualizarResumen();
    validarFormulario();

    console.log('Aplicación inicializada correctamente');
}

// ==========================================
// ACTUALIZAR PRECIOS EN LA INTERFAZ
// ==========================================
function actualizarPreciosInterfaz() {
    const precio126 = document.getElementById('precioTirador126x35');
    const precio37 = document.getElementById('precioTirador37x16');
    if (precio126) precio126.textContent = `${CONFIG.precios.Tirador_126x35.toFixed(2)} €`;
    if (precio37)  precio37.textContent  = `${CONFIG.precios.Tirador_37x16.toFixed(2)} €`;
}

// ==========================================
// SELECCIÓN DE MODELO
// ==========================================
function seleccionarModelo(card) {
    elementos.modelos.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.modelo = card.dataset.modelo;

    actualizarVistaPrevia();
    filtrarAcabadosPorModelo();
    actualizarDisponibilidadTirador();

    if (!state.alturaReal || state.alturaReal === 0) {
        mostrarValidacion('altura', validarMedida('altura', 0));
    } else {
        mostrarValidacion('altura', validarMedida('altura', state.alturaReal));
    }

    if (!state.anchoReal || state.anchoReal === 0) {
        mostrarValidacion('ancho', validarMedida('ancho', 0));
    } else {
        mostrarValidacion('ancho', validarMedida('ancho', state.anchoReal));
    }

    if (state.alturaReal > 0) {
        const v = validarMedida('altura', state.alturaReal);
        avisarSiBloqueoVidrio(v);
        actualizarDisponibilidadVidrio(!!v.motivoVidrio);
        if (v.valido && !v.bloqueado) {
            calcularBisagrasAutomaticas();
        } else {
            resetearWidgetBisagras();
        }
    } else {
        resetearWidgetBisagras();
    }

    calcularVidrio();
    actualizarResumen();
    validarFormulario();
}

// ==========================================
// ACTUALIZAR VISTA PREVIA DEL PERFIL
// ==========================================
function actualizarVistaPrevia() {
    const previewContainer = document.getElementById('previewVitrina');
    if (!previewContainer) return;

    if (state.modelo) {
        const modeloConfig = CONFIG.modelos[state.modelo];
        const nombreImagen = modeloConfig?.imagen || state.modelo;
        const imagenUrl = `https://raw.githubusercontent.com/Jdurba/Vitrinas/main/Imagenes/${nombreImagen}_cotas.jpg`;
        previewContainer.innerHTML = `
            <img src="${imagenUrl}"
                 alt="Perfil ${state.modelo}"
                 class="vitrina-preview-img"
                 onerror="this.parentElement.innerHTML='<div class=\\'preview-placeholder\\'><span>Imagen no disponible</span></div>'">
        `;
    } else {
        previewContainer.innerHTML = `<div class="preview-placeholder"><span>Vista previa del perfil</span></div>`;
    }
}

// ==========================================
// FILTRAR ACABADOS POR MODELO
// ==========================================
function filtrarAcabadosPorModelo() {
    const modeloConfig = CONFIG.modelos[state.modelo];
    const acabadosPermitidos = modeloConfig?.acabados || Object.keys(CONFIG.acabados);

    elementos.acabados.forEach(item => {
        const acabado = item.dataset.acabado;
        const disponible = acabadosPermitidos.includes(acabado);

        item.style.opacity = disponible ? '1' : '0.3';
        item.style.pointerEvents = disponible ? 'auto' : 'none';
        item.title = disponible ? '' : 'No disponible para este perfil';

        if (!disponible && state.acabado === acabado) {
            item.classList.remove('selected');
            state.acabado = null;
            actualizarResumen();
            validarFormulario();
        }
    });
}

// ==========================================
// DISPONIBILIDAD DEL TIRADOR POR MODELO
// ==========================================
function actualizarDisponibilidadTirador() {
    const modeloConfig = CONFIG.modelos[state.modelo];
    const bloqueado = !!modeloConfig?.sinTirador;

    const tiradorLabel = elementos.tirador?.closest('label');
    if (!tiradorLabel) return;

    if (bloqueado) {
        tiradorLabel.classList.add('disabled');
        elementos.tirador.disabled = true;

        if (state.tirador) {
            elementos.tirador.checked = false;
            state.tirador = false;
            state.tiradorTipo = null;
            elementos.tiradoresCards.forEach(c => c.classList.remove('selected'));
            if (elementos.tiradoresSelector) {
                elementos.tiradoresSelector.classList.remove('visible');
            }
            if (typeof aviso === 'function') {
                aviso('Este perfil no admite tirador mecanizado.\nSe ha eliminado el tirador de la configuración.');
            }
        }
    } else {
        tiradorLabel.classList.remove('disabled');
        elementos.tirador.disabled = false;
    }
}

// ==========================================
// SELECCIÓN DE ACABADO
// ==========================================
function seleccionarAcabado(item) {
    elementos.acabados.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    state.acabado = item.dataset.acabado;
    actualizarResumen();
    validarFormulario();
}

// ==========================================
// CÁLCULO DE MEDIDAS
// ==========================================
function calcularMedida(tipo, campo) {
    const modulo   = parseFloat(elementos[`${tipo}Modulo`]?.value) || 0;
    const descuento = parseFloat(elementos[`${tipo}Descuento`]?.value) || 0;
    const real     = parseFloat(elementos[`${tipo}Real`]?.value) || 0;

    switch (campo) {
        case 'modulo':
        case 'descuento': {
            const nuevoReal = modulo - descuento;
            if (elementos[`${tipo}Real`]) {
                elementos[`${tipo}Real`].value = nuevoReal !== 0 ? nuevoReal : '';
            }
            break;
        }
        case 'real': {
            const nuevoModulo = real + descuento;
            if (elementos[`${tipo}Modulo`]) {
                elementos[`${tipo}Modulo`].value = nuevoModulo !== 0 ? nuevoModulo : '';
            }
            break;
        }
    }

    state[`${tipo}Modulo`]   = parseFloat(elementos[`${tipo}Modulo`]?.value) || 0;
    state[`${tipo}Descuento`] = parseFloat(elementos[`${tipo}Descuento`]?.value) || 0;

    const valorRealInput = elementos[`${tipo}Real`]?.value;
    state[`${tipo}Real`] = valorRealInput !== '' ? parseFloat(valorRealInput) : 0;

    const validacion = validarMedida(tipo, state[`${tipo}Real`]);
    mostrarValidacion(tipo, validacion);
    avisarSiBloqueoVidrio(validacion);
    if (tipo === 'altura') actualizarDisponibilidadVidrio(!!validacion.motivoVidrio);
    calcularVidrio();

    if (validacion.bloqueado) {
        if (tipo === 'altura') resetearWidgetBisagras();
        state[`${tipo}Valido`] = false;
    } else {
        if (tipo === 'altura' && validacion.valido && state[`${tipo}Real`] > 0) {
            calcularBisagrasAutomaticas();
        } else if (tipo === 'altura') {
            resetearWidgetBisagras();
        }
    }

    actualizarResumen();
    validarFormulario();
}

// ==========================================
// CÁLCULO DE MEDIDAS DE VIDRIO (centralizado)
// Fórmula: real - descuento por modelo (DescV_Alt / DescV_Anc)
// ==========================================
function calcularVidrio() {
    const m = CONFIG.modelos[state.modelo];
    state.vidrioAlto  = (m && state.alturaReal > 0) ? state.alturaReal - (m.DescV_Alt || 0) : 0;
    state.vidrioAncho = (m && state.anchoReal  > 0) ? state.anchoReal  - (m.DescV_Anc || 0) : 0;
}

// Aviso modal si la altura queda bloqueada por vidrio > máximo
function avisarSiBloqueoVidrio(validacion) {
    if (validacion.motivoVidrio && typeof aviso === 'function') {
        aviso(`El vidrio resultante supera el máximo fabricable de ${VIDRIO_MAX_ALTO} mm de alto.\nNo es posible fabricar esta vitrina.`);
    }
}

// Habilitar/deshabilitar "Montada con Vidrio" según bloqueo por vidrio
function actualizarDisponibilidadVidrio(bloqueado) {
    if (!elementos.vidrioMontado) return;

    const label = elementos.vidrioMontado.closest('label');
    elementos.vidrioMontado.disabled = bloqueado;
    if (label) label.classList.toggle('disabled', bloqueado);

    if (bloqueado && state.vidrioMontado) {
        elementos.vidrioMontado.checked = false;
        // Reutiliza actualizarVidrio(): limpia color, deshabilita select y revalida
        elementos.vidrioMontado.dispatchEvent(new Event('change'));
    }
}

// ==========================================
// VALIDACIÓN DE MEDIDAS
// ==========================================
function validarMedida(tipo, valor) {
    const modelo = CONFIG.modelos[state.modelo];

    if (!modelo) {
        return { valido: false, mensaje: '← Selecciona un modelo primero', clase: 'info', bloqueado: false };
    }

    const max = tipo === 'altura' ? modelo.maxAltura : modelo.maxAncho;

    if (valor < 0) {
        return { valido: false, mensaje: '⛔ No se permiten valores negativos', clase: 'error', bloqueado: true };
    }

    if (!valor || valor === 0) {
        return { valido: false, mensaje: `Rango válido: ${modelo.Minimo}-${max} mm`, clase: 'info', bloqueado: false };
    }

    if (valor < modelo.Minimo) {
        return { valido: false, mensaje: `⛔ Mínimo absoluto: ${modelo.Minimo} mm`, clase: 'error', bloqueado: true };
    }

    // Bloqueo duro: vidrio resultante supera el máximo fabricable
    if (tipo === 'altura') {
        const vidrioAlto = valor - (modelo.DescV_Alt || 0);
        if (vidrioAlto > VIDRIO_MAX_ALTO) {
            return {
                valido: false,
                mensaje: `⛔ Vidrio ${vidrioAlto} mm supera el máximo fabricable (${VIDRIO_MAX_ALTO} mm)`,
                clase: 'error',
                bloqueado: true,
                motivoVidrio: true
            };
        }
    }

    if (valor > max) {
        return { valido: true, mensaje: `⚠️ Supera máximo recomendado (${max} mm)`, clase: 'advertencia', bloqueado: false };
    }

    return { valido: true, mensaje: `✓ Válido (${modelo.Minimo}-${max} mm)`, clase: 'valido', bloqueado: false };
}

// ==========================================
// MOSTRAR VALIDACIÓN
// ==========================================
function mostrarValidacion(tipo, resultado) {
    const inputEl   = elementos[`${tipo}Real`];
    const mensajeEl = elementos[`${tipo}Mensaje`];
    if (!inputEl || !mensajeEl) return;

    inputEl.classList.remove('valido', 'advertencia', 'error', 'bloqueado', 'info');

    if (resultado.bloqueado && state[`${tipo}Real`] > 0) {
        inputEl.classList.add('bloqueado');
    } else if (resultado.clase) {
        inputEl.classList.add(resultado.clase);
    }

    mensajeEl.textContent = resultado.mensaje;
    mensajeEl.className = `medidas-mensaje ${resultado.clase}`;
    state[`${tipo}Valido`] = resultado.valido && !resultado.bloqueado;
}

// ==========================================
// CÁLCULO AUTOMÁTICO DE BISAGRAS
// ==========================================
function calcularBisagrasAutomaticas() {
    const altura = state.alturaReal;
    const modeloConfig = CONFIG.modelos[state.modelo];

    if (!altura || altura <= 0 || !modeloConfig) {
        resetearWidgetBisagras();
        return;
    }

    if (modeloConfig.bisagras_fijas) {
        state.bisagrasNominal    = modeloConfig.bisagras_fijas;
        state.bisagrasExtras     = 0;
        state.bisagrasMaxTecnico = modeloConfig.bisagras_fijas;
        state.bisagrasCalculadas = modeloConfig.bisagras_fijas;
        state.bisagrasTotal      = modeloConfig.bisagras_fijas;
        state.bisagras           = String(modeloConfig.bisagras_fijas);
        renderWidgetBisagras(true);
        return;
    }

    let nominal = 2;
    for (const rango of CONFIG.bisagras_rangos) {
        if (altura <= rango.hasta) { nominal = rango.num; break; }
        nominal = rango.num;
    }

    const B1 = CONFIG.bisagras_B1_defecto;
    const B2 = CONFIG.bisagras_B2_defecto;
    const Cmin = CONFIG.bisagras_C_minimo;
    const maxTecnico = Math.min(
        CONFIG.bisagras_max_global,
        Math.floor((altura - B1 - B2) / Cmin) + 2
    );

    state.bisagrasNominal    = nominal;
    state.bisagrasExtras     = 0;
    state.bisagrasMaxTecnico = Math.max(nominal, maxTecnico);
    state.bisagrasTotal      = nominal;
    state.bisagrasCalculadas = nominal;
    state.bisagras           = String(nominal);

    renderWidgetBisagras(false);
}

function renderWidgetBisagras(fijas) {
    const { bisagrasNominal, bisagrasMaxTecnico, bisagrasTotal } = state;

    if (elementos.bisagrasWidget) elementos.bisagrasWidget.classList.add('activo');

    if (elementos.bisagrasNominalInfo) {
        elementos.bisagrasNominalInfo.classList.add('activo');
        elementos.bisagrasNominalInfo.textContent = fijas
            ? 'Bisagras fijas para este perfil'
            : `Nominal: ${bisagrasNominal}  ·  Máx. técnico: ${bisagrasMaxTecnico}`;
    }

    if (elementos.bisagrasNum) {
        elementos.bisagrasNum.textContent = bisagrasTotal;
        elementos.bisagrasNum.classList.remove('inactivo');
    }

    const labelEl = document.getElementById('bisagrasLabel');
    if (labelEl) labelEl.classList.remove('disabled');

    if (elementos.bisagrasMenos) elementos.bisagrasMenos.disabled = fijas || bisagrasTotal <= bisagrasNominal;
    if (elementos.bisagrasmas)   elementos.bisagrasmas.disabled   = fijas || bisagrasTotal >= bisagrasMaxTecnico;

    actualizarPrecioBisagrasExtra();
}

function resetearWidgetBisagras() {
    state.bisagrasNominal    = 0;
    state.bisagrasExtras     = 0;
    state.bisagrasMaxTecnico = 0;
    state.bisagrasTotal      = 0;
    state.bisagrasCalculadas = 0;
    state.bisagras           = '';

    if (elementos.bisagrasWidget) elementos.bisagrasWidget.classList.remove('activo');
    if (elementos.bisagrasNominalInfo) {
        elementos.bisagrasNominalInfo.classList.remove('activo');
        elementos.bisagrasNominalInfo.textContent = 'Introduce altura real primero';
    }
    if (elementos.bisagrasNum) {
        elementos.bisagrasNum.textContent = '—';
        elementos.bisagrasNum.classList.add('inactivo');
    }
    if (elementos.bisagrasMenos) elementos.bisagrasMenos.disabled = true;
    if (elementos.bisagrasmas)   elementos.bisagrasmas.disabled   = true;
    if (elementos.bisagrasExtraPrecio) elementos.bisagrasExtraPrecio.textContent = '';
    if (elementos.bisagrasAdvertencia) elementos.bisagrasAdvertencia.textContent = '';

    const labelEl = document.getElementById('bisagrasLabel');
    if (labelEl) labelEl.classList.add('disabled');
}

function cambiarBisagrasExtra(delta) {
    const modeloConfig = CONFIG.modelos[state.modelo];
    if (modeloConfig?.bisagras_fijas) return;

    const nuevo = state.bisagrasTotal + delta;
    if (nuevo < state.bisagrasNominal || nuevo > state.bisagrasMaxTecnico) return;

    state.bisagrasExtras = nuevo - state.bisagrasNominal;
    state.bisagrasTotal  = nuevo;
    state.bisagras       = String(nuevo);

    if (elementos.bisagrasNum) elementos.bisagrasNum.textContent = nuevo;
    if (elementos.bisagrasMenos) elementos.bisagrasMenos.disabled = nuevo <= state.bisagrasNominal;
    if (elementos.bisagrasmas)   elementos.bisagrasmas.disabled   = nuevo >= state.bisagrasMaxTecnico;

    actualizarPrecioBisagrasExtra();
    actualizarResumen();
    validarFormulario();
}

function actualizarPrecioBisagrasExtra() {
    if (!elementos.bisagrasExtraPrecio) return;
    if (state.bisagrasExtras > 0) {
        const precio = state.bisagrasExtras * CONFIG.precios.bisagra_extra;
        elementos.bisagrasExtraPrecio.textContent =
            `+${state.bisagrasExtras} bisagra${state.bisagrasExtras > 1 ? 's' : ''} extra: +${precio.toFixed(2)} €`;
    } else {
        elementos.bisagrasExtraPrecio.textContent = '';
    }
    if (elementos.bisagrasAdvertencia) elementos.bisagrasAdvertencia.textContent = '';
}

// ==========================================
// ACTUALIZACIÓN DE OPCIONES
// ==========================================
function actualizarCantidad(e) {
    state.cantidad = parseInt(e.target.value) || 1;
    actualizarResumen();
    validarFormulario();
}

function actualizarTirador(e) {
    state.tirador = e.target.checked;

    if (elementos.tiradoresSelector) {
        if (state.tirador) {
            elementos.tiradoresSelector.classList.add('visible');
        } else {
            elementos.tiradoresSelector.classList.remove('visible');
            elementos.tiradoresCards.forEach(card => card.classList.remove('selected'));
            state.tiradorTipo = null;
        }
    }

    actualizarResumen();
    validarFormulario();
}

function seleccionarTirador(card) {
    elementos.tiradoresCards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.tiradorTipo = card.dataset.tirador;
    actualizarResumen();
    validarFormulario();
}

function actualizarVidrio(e) {
    state.vidrioMontado = e.target.checked;

    if (elementos.colorVidrio) elementos.colorVidrio.disabled = !state.vidrioMontado;
    if (elementos.colorVidrioLabel) {
        elementos.colorVidrioLabel.classList.toggle('disabled', !state.vidrioMontado);
        elementos.colorVidrioLabel.classList.toggle('active-label', state.vidrioMontado);
    }

    if (!state.vidrioMontado) {
        state.colorVidrio = '';
        if (elementos.colorVidrio) elementos.colorVidrio.value = '';
    }

    actualizarResumen();
    validarFormulario();
}

function actualizarColorVidrio(e) {
    state.colorVidrio = e.target.value;
    actualizarResumen();
    validarFormulario();
}

// ==========================================
// ACTUALIZAR RESUMEN LATERAL
// ==========================================
function actualizarResumen() {
    if (elementos.resumenModelo) {
        elementos.resumenModelo.textContent = state.modelo
            ? `${state.modelo} - ${CONFIG.modelos[state.modelo]?.nombre || ''}`
            : '-';
    }

    if (elementos.resumenAcabado) {
        elementos.resumenAcabado.textContent = state.acabado
            ? CONFIG.acabados[state.acabado]?.nombre || '-'
            : '-';
    }

    if (elementos.resumenDimensiones) {
        const altReal = state.alturaReal || '-';
        const ancReal = state.anchoReal || '-';
        elementos.resumenDimensiones.textContent = (altReal !== '-' && ancReal !== '-')
            ? `${altReal} × ${ancReal} mm`
            : '-';
    }

    if (elementos.resumenVidrioMedidas) {
        elementos.resumenVidrioMedidas.textContent =
            (state.vidrioAlto > 0 && state.vidrioAncho > 0)
                ? `${state.vidrioAlto} × ${state.vidrioAncho} mm`
                : '-';
    }

    if (elementos.resumenCantidad) {
        elementos.resumenCantidad.textContent = state.cantidad > 0
            ? `${state.cantidad} unidad${state.cantidad > 1 ? 'es' : ''}`
            : '-';
    }

    actualizarResumenBisagras();

    if (elementos.resumenTirador) {
        let textoTirador = 'No';
        if (state.tirador && state.tiradorTipo) {
            const tirador = CONFIG.tiradores[state.tiradorTipo];
            const precio  = CONFIG.precios[`Tirador_${state.tiradorTipo}`];
            textoTirador = `Sí (${tirador.medidas} - ${precio.toFixed(2)} €)`;
        } else if (state.tirador) {
            textoTirador = 'Sí (sin seleccionar)';
        }
        elementos.resumenTirador.textContent = textoTirador;
    }

    if (elementos.resumenVidrio) {
        let texto = state.vidrioMontado ? 'Sí' : 'No';
        if (state.vidrioMontado && state.colorVidrio) {
            texto += ` (${formatearColorVidrio(state.colorVidrio)})`;
        }
        elementos.resumenVidrio.textContent = texto;
    }
}

function actualizarResumenBisagras() {
    if (!elementos.resumenBisagras) return;

    elementos.resumenBisagras.textContent = state.bisagrasTotal > 0
        ? state.bisagrasTotal.toString()
        : '-';

    if (elementos.resumenBisagrasExtra) {
        if (state.bisagrasExtras > 0) {
            const precio = state.bisagrasExtras * CONFIG.precios.bisagra_extra;
            elementos.resumenBisagrasExtra.textContent =
                `+${state.bisagrasExtras} extra${state.bisagrasExtras > 1 ? 's' : ''} (+${precio.toFixed(2)} €)`;
        } else {
            elementos.resumenBisagrasExtra.textContent = '';
        }
    }
}

function formatearColorVidrio(color) {
    return CONFIG.coloresVidrio[color]?.nombre || color;
}

// ==========================================
// VALIDACIÓN DEL FORMULARIO
// ==========================================
function validarFormulario() {
    const bisagrasValidas = state.bisagrasTotal >= 2;
    const alturaValida    = state.alturaValido !== false && state.alturaReal > 0;
    const anchoValida     = state.anchoValido  !== false && state.anchoReal  > 0;
    const tiradorValido   = !state.tirador || (state.tirador && state.tiradorTipo);
    const vidrioValido    = !state.vidrioMontado || (state.vidrioMontado && state.colorVidrio !== '');

    const completo =
        state.modelo  !== null &&
        state.acabado !== null &&
        alturaValida &&
        anchoValida &&
        state.cantidad >= 1 &&
        bisagrasValidas &&
        tiradorValido &&
        vidrioValido;

    if (elementos.btnCalcular) elementos.btnCalcular.disabled = !completo;
    if (elementos.btnFabricar) elementos.btnFabricar.disabled = !completo;
}

// ==========================================
// BOTÓN CALCULAR → vista de presupuesto (presupuesto.js)
// ==========================================
function calcularPresupuesto() {
    mostrarPresupuesto();
}

// ==========================================
// BOTÓN RESET
// ==========================================
function resetearDatos() {
    confirmar('¿Estás seguro de que quieres borrar todos los datos?', ejecutarReset);
}

function ejecutarReset() {
    state.modelo = null;
    actualizarVistaPrevia();
    state.acabado = null;
    state.alturaModulo = 0;
    state.alturaDescuento = 2;
    state.alturaReal = 0;
    state.alturaValido = null;
    state.anchoModulo = 0;
    state.anchoDescuento = 2;
    state.anchoReal = 0;
    state.anchoValido = null;
    state.cantidad = 1;
    state.bisagrasNominal    = 0;
    state.bisagrasExtras     = 0;
    state.bisagrasTotal      = 0;
    state.bisagrasMaxTecnico = 0;
    state.bisagrasCalculadas = 0;
    state.bisagras           = '';
    state.tirador = false;
    state.vidrioMontado = false;
    state.colorVidrio = '';
    state.vidrioAlto = 0;
    state.vidrioAncho = 0;

    elementos.modelos.forEach(c => c.classList.remove('selected'));
    elementos.acabados.forEach(i => i.classList.remove('selected'));


    if (elementos.alturaModulo)   elementos.alturaModulo.value = '';
    if (elementos.alturaDescuento) elementos.alturaDescuento.value = '2';
    if (elementos.alturaReal)     elementos.alturaReal.value = '';
    if (elementos.alturaMensaje)  elementos.alturaMensaje.textContent = '';
    if (elementos.anchoModulo)    elementos.anchoModulo.value = '';
    if (elementos.anchoDescuento) elementos.anchoDescuento.value = '2';
    if (elementos.anchoReal)      elementos.anchoReal.value = '';
    if (elementos.anchoMensaje)   elementos.anchoMensaje.textContent = '';
    if (elementos.cantidad)       elementos.cantidad.value = '1';

    resetearWidgetBisagras();

    if (elementos.tirador) elementos.tirador.checked = false;
    if (elementos.tiradoresSelector) elementos.tiradoresSelector.classList.remove('visible');
    elementos.tiradoresCards.forEach(card => card.classList.remove('selected'));
    state.tiradorTipo = null;

    // Restaurar tirador (puede haber quedado bloqueado por modelo previo)
    const tiradorLabel = elementos.tirador?.closest('label');
    if (tiradorLabel) {
        tiradorLabel.classList.remove('disabled');
        if (elementos.tirador) elementos.tirador.disabled = false;
    }

    if (elementos.vidrioMontado) {
        elementos.vidrioMontado.checked = false;
        elementos.vidrioMontado.dispatchEvent(new Event('change'));
    }
    actualizarDisponibilidadVidrio(false);

    actualizarResumen();
    validarFormulario();
}

// ==========================================
// INICIAR APLICACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', init);
