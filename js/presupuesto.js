// ==========================================
// PRESUPUESTO — Configurador de Vitrinas
//   · Carga de VitrinasPrecios.csv (ISO-8859-1, ;)
//   · Cálculo por escalones ancho×alto (al alza)
//   · Composición de código y denominación Odoo
//   · Vista de presupuesto (pantalla completa)
// ==========================================

// ── Carga y parseo del CSV de tarifas ──────────────────────────
let TARIFAS = null;   // caché de filas parseadas

async function cargarTarifas() {
    if (TARIFAS) return TARIFAS;

    const resp = await fetch('TarifaVitrinas.csv?v=1');
    if (!resp.ok) throw new Error(`No se pudo cargar la tarifa (HTTP ${resp.status})`);

    const buf   = await resp.arrayBuffer();
    // Codificación automática: UTF-8 con BOM (Excel moderno) o ISO-8859-1 (Excel clásico)
    const bytes = new Uint8Array(buf);
    const tieneBOM = bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
    const texto = new TextDecoder(tieneBOM ? 'utf-8' : 'iso-8859-1').decode(buf);

    const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');

    // Mapeo por cabecera: el orden de columnas del CSV es libre
    const cab = lineas[0].split(';').map(c => c.trim());
    const col = nombre => cab.indexOf(nombre);
    const iPerfil = col('Perfil'), iAncho = col('Ancho'), iAlto = col('Alto'),
          iTarifa = col('Tarifa'), iVidrio = col('ColorVidrio'), iAcabado = col('Acabado');
    if ([iPerfil, iAncho, iAlto, iTarifa, iVidrio, iAcabado].includes(-1)) {
        throw new Error('Cabecera del CSV incorrecta. Se esperan: Perfil, Ancho, Alto, Tarifa, ColorVidrio, Acabado');
    }

    TARIFAS = lineas
        .slice(1)
        .map(l => {
            const c = l.split(';');
            // Tarifa: admite "128,60", "1.128,60" (formato ES) y "128.60"
            let tarifaStr = (c[iTarifa] || '').trim();
            if (tarifaStr.includes(',')) {
                tarifaStr = tarifaStr.replace(/\./g, '').replace(',', '.');
            }
            return {
                perfil:      (c[iPerfil]  || '').trim(),
                ancho:       parseInt(c[iAncho], 10),
                alto:        parseInt(c[iAlto], 10),
                tarifa:      parseFloat(tarifaStr),
                colorVidrio: (c[iVidrio]  || '').trim(),
                acabado:     (c[iAcabado] || '').trim()
            };
        })
        // Descarta filas corruptas (p.ej. #¡REF! de Excel) o incompletas
        .filter(f => CONFIG.modelos[f.perfil] && !isNaN(f.ancho) && !isNaN(f.alto) && !isNaN(f.tarifa));

    return TARIFAS;
}

// ── Búsqueda de tarifa: escalón al alza ─────────────────────────
function buscarTarifa(perfil, grupoAcabado, grupoVidrio, ancho, alto) {
    const filas = TARIFAS.filter(f =>
        f.perfil === perfil &&
        f.acabado === grupoAcabado &&
        f.colorVidrio === grupoVidrio
    );

    if (filas.length === 0) {
        return { consultar: true, motivo: 'Combinación no disponible en tarifa' };
    }

    const anchos   = [...new Set(filas.map(f => f.ancho))].sort((a, b) => a - b);
    const anchoEsc = anchos.find(a => a >= ancho);
    if (anchoEsc === undefined) {
        return { consultar: true, motivo: `Ancho ${ancho} mm fuera de tarifa (máx. ${anchos[anchos.length - 1]} mm)` };
    }

    const filasAncho = filas.filter(f => f.ancho === anchoEsc);
    const altos      = [...new Set(filasAncho.map(f => f.alto))].sort((a, b) => a - b);
    const altoEsc    = altos.find(a => a >= alto);
    if (altoEsc === undefined) {
        return { consultar: true, motivo: `Alto ${alto} mm fuera de tarifa (máx. ${altos[altos.length - 1]} mm)` };
    }

    const fila = filasAncho.find(f => f.alto === altoEsc);
    return { consultar: false, tarifa: fila.tarifa, escalon: `${anchoEsc} × ${altoEsc} mm` };
}

// ── Composición de código y denominación Odoo ───────────────────
// Código: VV.{codeTipo}{codeVidrio}.{codAcabado}  ej: VV.0101.A.PM
function componerCodigo() {
    const m  = CONFIG.modelos[state.modelo];
    const a  = CONFIG.acabados[state.acabado];
    const cv = state.vidrioMontado ? CONFIG.coloresVidrio[state.colorVidrio] : null;
    return `VV.${m.codeTipo}${cv ? cv.codeVidrio : '00'}.${a.codigo}`;
}

function componerDenominacion() {
    const m  = CONFIG.modelos[state.modelo];
    const a  = CONFIG.acabados[state.acabado];
    const cv = state.vidrioMontado ? CONFIG.coloresVidrio[state.colorVidrio] : null;
    return `${m.denominacion} ${a.denominacion}` + (cv ? ` + ${cv.denominacion}` : '');
}

function componerObservaciones() {
    const partes = [
        `Medidas: ${state.anchoReal} x ${state.alturaReal} mm`,
        `Vidrio: ${state.vidrioAncho} x ${state.vidrioAlto} mm`,
        `${state.bisagrasTotal} bisagras`
    ];
    return partes.join(' - ');
}

// ── Cálculo completo del presupuesto ────────────────────────────
function calcularPresupuestoCompleto() {
    const m = CONFIG.modelos[state.modelo];
    const grupoAcabado = CONFIG.acabados[state.acabado].grupoPrecio;
    const grupoVidrio  = state.vidrioMontado
        ? CONFIG.coloresVidrio[state.colorVidrio].grupoPrecio
        : 'SINVIDRIO';

    const resultado = {
        codigo:        componerCodigo(),
        denominacion:  componerDenominacion(),
        observaciones: componerObservaciones(),
        grupoAcabado,
        grupoVidrio,
        consultar:     false,
        motivo:        '',
        tarifa:        0,
        escalon:       '',
        precioTirador: 0,
        precioBisagras: 0,
        precioUnidad:  0,
        cantidad:      state.cantidad,
        total:         0
    };

    // Vidrio especial → siempre consultar
    if (grupoVidrio === 'CONSULTAR') {
        resultado.consultar = true;
        resultado.motivo = 'Vidrio especial';
        return resultado;
    }

    const t = buscarTarifa(state.modelo, grupoAcabado, grupoVidrio, state.anchoReal, state.alturaReal);
    if (t.consultar) {
        resultado.consultar = true;
        resultado.motivo = t.motivo;
        return resultado;
    }

    resultado.tarifa  = t.tarifa;
    resultado.escalon = t.escalon;

    if (state.tirador && state.tiradorTipo) {
        resultado.precioTirador = CONFIG.precios[`Tirador_${state.tiradorTipo}`];
    }
    resultado.precioBisagras = state.bisagrasExtras * CONFIG.precios.bisagra_extra;

    resultado.precioUnidad = resultado.tarifa + resultado.precioTirador + resultado.precioBisagras;
    resultado.total        = resultado.precioUnidad * resultado.cantidad;

    return resultado;
}

// ── Utilidades de la vista ──────────────────────────────────────
function fmtEur(n) {
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Copia de respaldo si el navegador no expone navigator.clipboard
function fallbackCopia(texto, onOk) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); if (onOk) onOk(); } catch (_) {}
    document.body.removeChild(ta);
}

// ── Vista de presupuesto (informe hoja A4, lenguaje ecosistema) ─
async function mostrarPresupuesto() {
    try {
        await cargarTarifas();
    } catch (e) {
        aviso(`Error al cargar la tarifa de precios:\n${e.message}`);
        return;
    }

    const r = calcularPresupuestoCompleto();
    pintarInforme(r);

    document.getElementById('mainHeader').style.display    = 'none';
    document.getElementById('mainContainer').style.display = 'none';
    document.body.classList.add('informe-activo');
    document.getElementById('presu-barra').classList.add('visible');
    document.getElementById('presuVista').style.display    = 'block';
    window.scrollTo({ top: 0, behavior: 'instant' });
}

function volverDePresupuesto() {
    document.getElementById('presuVista').style.display    = 'none';
    document.getElementById('presu-barra').classList.remove('visible');
    document.body.classList.remove('informe-activo');
    document.getElementById('mainHeader').style.display    = '';
    document.getElementById('mainContainer').style.display = '';
    window.scrollTo({ top: 0, behavior: 'instant' });
}

function pintarInforme(r) {
    const m  = CONFIG.modelos[state.modelo];
    const a  = CONFIG.acabados[state.acabado];

    // Fecha y versión
    document.getElementById('presuFecha').textContent = new Date().toLocaleDateString('es-ES');
    document.getElementById('presuVersion').textContent =
        window.VERSION_APP ? 'Adinor · Vitrinas · ' + window.VERSION_APP : 'Adinor · Vitrinas';

    // Imagen del perfil (misma fuente que la vista previa del Form1)
    const nombreImagen = m.imagen || state.modelo;
    const imagenUrl = `https://raw.githubusercontent.com/Jdurba/Vitrinas/main/Imagenes/${nombreImagen}_cotas.jpg`;
    document.getElementById('presuImagen').innerHTML =
        `<img src="${imagenUrl}" alt="Perfil ${state.modelo}"
              onerror="this.parentElement.innerHTML='<div class=\\'preview-placeholder\\'>Imagen no disponible</div>'">`;

    // Parámetros — línea a línea (una sola columna, junto a la imagen)
    const dato = (l, v) =>
        `<div class="campo-informe"><label>${l}</label><span class="valor">${v}</span></div>`;

    document.getElementById('presuDatos').innerHTML =
        dato('Modelo', state.modelo + ' — ' + m.nombre) +
        dato('Acabado', a.nombre) +
        dato('Medidas vitrina', state.anchoReal + ' × ' + state.alturaReal + ' mm') +
        dato('Medida vidrio', state.vidrioAncho + ' × ' + state.vidrioAlto + ' mm') +
        dato('Vidrio montado', state.vidrioMontado ? 'Sí — ' + CONFIG.coloresVidrio[state.colorVidrio].nombre : 'No') +
        dato('Bisagras', state.bisagrasTotal + (state.bisagrasExtras > 0 ? ' (' + state.bisagrasExtras + ' extra)' : '')) +
        dato('Tirador', state.tirador && state.tiradorTipo ? CONFIG.tiradores[state.tiradorTipo].medidas : 'No') +
        dato('Cantidad', state.cantidad + ' ud.');

    // Artículos: línea principal (código Odoo), extras y observaciones
    const btnCopia = (valor) =>
        `<button type="button" class="btn-copia" data-copia="${valor.replace(/"/g, '&quot;')}"
                 title="Copiar" data-html2canvas-ignore>📋</button>`;

    const cant = r.cantidad;
    const precioCel = (unit) => r.consultar
        ? '<span class="incluido">consultar</span>'
        : fmtEur(unit * cant);

    let filas = `<tr>
        <td class="copia" data-html2canvas-ignore>${btnCopia(r.codigo)}</td>
        <td class="cod">${r.codigo}</td>
        <td>${r.denominacion}</td>
        <td class="num">${cant}</td>
        <td class="num">${precioCel(r.tarifa)}</td>
    </tr>`;

    // Observaciones: segunda línea, ligada a la vitrina (justo debajo)
    filas += `<tr class="obs">
        <td class="copia" data-html2canvas-ignore>${btnCopia(r.observaciones)}</td>
        <td></td>
        <td colspan="3">${r.observaciones}</td>
    </tr>`;

    if (r.precioTirador > 0) {
        filas += `<tr>
            <td class="copia" data-html2canvas-ignore></td>
            <td class="cod"></td>
            <td>Tirador mecanizado ${CONFIG.tiradores[state.tiradorTipo].medidas}</td>
            <td class="num">${cant}</td>
            <td class="num">${precioCel(r.precioTirador)}</td>
        </tr>`;
    }
    if (r.precioBisagras > 0) {
        filas += `<tr>
            <td class="copia" data-html2canvas-ignore></td>
            <td class="cod"></td>
            <td>Bisagras extra (${state.bisagrasExtras} ud.)</td>
            <td class="num">${cant}</td>
            <td class="num">${precioCel(r.precioBisagras)}</td>
        </tr>`;
    }

    document.getElementById('presuArticulos').innerHTML = filas;

    // Total o CONSULTAR + motivo
    const motivoEl = document.getElementById('presuMotivo');
    if (r.consultar) {
        document.getElementById('presuTotal').textContent = 'CONSULTAR';
        motivoEl.textContent = 'Precio bajo consulta: ' + r.motivo;
        motivoEl.style.display = 'block';
    } else {
        document.getElementById('presuTotal').textContent = fmtEur(r.total);
        motivoEl.style.display = 'none';
    }

    // Delegación: copiar al portapapeles con feedback ✓
    document.getElementById('presuArticulos').onclick = (e) => {
        const btn = e.target.closest('.btn-copia');
        if (!btn) return;
        const texto = btn.dataset.copia;
        const ok = () => {
            const orig = btn.textContent;
            btn.textContent = '✓'; btn.classList.add('ok');
            setTimeout(() => { btn.textContent = orig; btn.classList.remove('ok'); }, 1200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(texto).then(ok).catch(() => fallbackCopia(texto, ok));
        } else {
            fallbackCopia(texto, ok);
        }
    };
}

// ── PDF: captura fiel de la hoja A4 con html2canvas ─────────────
async function generarPDFPresupuesto() {
    const btn = document.getElementById('presuBtnPDF');
    const textoOrig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generando…';

    try {
        const { jsPDF } = window.jspdf;
        const hoja = document.getElementById('presu-informe-container');

        const canvas = await html2canvas(hoja, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pw = pdf.internal.pageSize.getWidth();    // 210
        const ph = pdf.internal.pageSize.getHeight();   // 297
        const imgW = pw;
        const imgH = canvas.height * pw / canvas.width;

        const imgData = canvas.toDataURL('image/jpeg', 0.92);

        if (imgH <= ph) {
            pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);
        } else {
            let restante = imgH;
            let posicion = 0;
            while (restante > 0) {
                pdf.addImage(imgData, 'JPEG', 0, posicion, imgW, imgH);
                restante -= ph;
                if (restante > 0) { pdf.addPage(); posicion -= ph; }
            }
        }

        pdf.save(`Vitrina_${state.modelo}_${state.anchoReal}x${state.alturaReal}.pdf`);
    } catch (e) {
        aviso('No se pudo generar el PDF.\n' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = textoOrig;
    }
}

// ── Inicialización de la vista ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('presuBtnVolver')?.addEventListener('click', volverDePresupuesto);
    document.getElementById('presuBtnPDF')?.addEventListener('click', generarPDFPresupuesto);
    document.getElementById('presuBtnNueva')?.addEventListener('click', () => {
        confirmar('¿Iniciar una nueva configuración?\nSe perderán los datos actuales.', () => {
            volverDePresupuesto();
            ejecutarReset();
        });
    });
});
