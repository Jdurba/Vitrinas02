// ==========================================
// PRESUPUESTO — Configurador de Vitrinas
//   · Carga de VitrinasPrecios.csv (ISO-8859-1, ;)
//   · Cálculo por escalones ancho×alto (al alza)
//   · Composición de código y denominación Odoo
//   · Vista de presupuesto (pantalla completa)
// ==========================================

// ── Helper de carga: fetch + decodificación + split en líneas ───
// Reutilizado por cargarTarifas() y cargarExtras().
// Codificación automática: UTF-8 con BOM (Excel moderno) o ISO-8859-1 (Excel clásico).
async function cargarCSV(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${resp.status})`);

    const buf   = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const tieneBOM = bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
    const texto = new TextDecoder(tieneBOM ? 'utf-8' : 'iso-8859-1').decode(buf);

    return texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
}

// Normaliza una tarifa en formato ES ("1.128,60") o EN ("128.60") a número.
function parseTarifaES(str) {
    let s = (str || '').trim();
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s);
}

// ── Carga y parseo del CSV de tarifas ──────────────────────────
let TARIFAS = null;   // caché de filas parseadas

async function cargarTarifas() {
    if (TARIFAS) return TARIFAS;

    const lineas = await cargarCSV('TarifaVitrinas.csv?v=1');

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
            return {
                perfil:      (c[iPerfil]  || '').trim(),
                ancho:       parseInt(c[iAncho], 10),
                alto:        parseInt(c[iAlto], 10),
                tarifa:      parseTarifaES(c[iTarifa]),
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

// ── Carga y parseo de TarifaExtras.csv ──────────────────────────
// Tiradores, mecanizados, bisagras adjuntadas y bases.
let EXTRAS = null;   // caché de filas parseadas

async function cargarExtras() {
    if (EXTRAS) return EXTRAS;

    const lineas = await cargarCSV('TarifaExtras.csv?v=1');
    const cab = lineas[0].split(';').map(c => c.trim());
    const col = n => cab.indexOf(n);

    const iCod = col('Codigo'), iDen = col('Denominacion'), iTar = col('Tarifa'),
          iFam = col('Familia'), iAca = col('Acabado'), iCol = col('Color'),
          iTipoM = col('TipoMontaje'), iTipoB = col('TipoBisagra'),
          iCos = col('Costado'), iDto = col('Dto');
    if ([iCod, iDen, iTar].includes(-1)) {
        throw new Error('Cabecera de TarifaExtras incorrecta. Mínimo: Codigo, Denominacion, Tarifa');
    }

    EXTRAS = lineas.slice(1).map(l => {
        const c = l.split(';');
        const tarStr = (c[iTar] || '').trim();
        const consultar = /consultar/i.test(tarStr);
        return {
            codigo:       (c[iCod]   || '').trim(),
            denominacion: (c[iDen]   || '').trim(),
            tarifa:       consultar ? 0 : (parseTarifaES(tarStr) || 0),
            consultar,
            familia:      (c[iFam]   || '').trim(),
            acabado:      (c[iAca]   || '').trim(),
            color:        (c[iCol]   || '').trim(),
            tipoMontaje:  (c[iTipoM] || '').trim(),
            tipoBisagra:  (c[iTipoB] || '').trim(),
            costado:      (c[iCos]   || '').trim(),
            dto:          parseInt((c[iDto] || '0').trim(), 10) || 0
        };
    }).filter(f => f.codigo !== '');

    return EXTRAS;
}

// ── Lookup genérico en TarifaExtras ─────────────────────────────
// filtros: columnas a casar. Claves:
//   codigoExacto | codigoPrefijo | familia | acabado | color |
//   tipoMontaje | tipoBisagra | costado.
// tipoBisagra usa match "contiene": la fila 'ALU20/D35' casa con 'ALU20' o 'D35'.
// Devuelve { encontrado, consultar, codigo, denominacion, tarifa, dto }.
function buscarExtra(filtros) {
    const casa = f => {
        if (filtros.codigoExacto  && f.codigo !== filtros.codigoExacto) return false;
        if (filtros.codigoPrefijo && !f.codigo.startsWith(filtros.codigoPrefijo + '.')) return false;
        if (filtros.familia     !== undefined && f.familia     !== filtros.familia)     return false;
        if (filtros.acabado     !== undefined && f.acabado     !== filtros.acabado)     return false;
        if (filtros.color       !== undefined && f.color       !== filtros.color)       return false;
        if (filtros.tipoMontaje !== undefined && f.tipoMontaje !== filtros.tipoMontaje) return false;
        if (filtros.tipoBisagra !== undefined && !f.tipoBisagra.split('/').includes(filtros.tipoBisagra)) return false;
        if (filtros.costado     !== undefined && f.costado     !== filtros.costado)     return false;
        return true;
    };

    const filas = EXTRAS.filter(casa);
    if (filas.length === 0) return { encontrado: false };
    if (filas.length > 1) console.warn('buscarExtra: múltiples filas para', filtros, '→ se usa la primera');
    const f = filas[0];
    return {
        encontrado:   true,
        consultar:    f.consultar,
        codigo:       f.codigo,
        denominacion: f.denominacion,
        tarifa:       f.tarifa,
        dto:          f.dto
    };
}

// ── Helpers de alto nivel por familia ───────────────────────────
// Encapsulan la lógica SQL de cada línea. La Fase 3 los invoca directamente.

// (3) Bisagra. Estándar: TipoBisagra + TipoMontaje + Color.
//     KABI/HAVA: TipoBisagra + Acabado (Color vacío en CSV).
function buscarBisagra(tipoBisagra, { montaje, color, acabado } = {}) {
    const esFijaAcabado = tipoBisagra === 'KABI' || tipoBisagra === 'HAVA';
    if (esFijaAcabado) {
        return buscarExtra({ familia: 'Bisagra', tipoBisagra, acabado });
    }
    return buscarExtra({ familia: 'Bisagra', tipoBisagra, tipoMontaje: montaje, color });
}

// (4) Base. Dependiente de TipoBisagra (ALU20/D35 o D35-S) + Color + Costado.
//     KABI/HAVA no llevan base → devuelve null (sin línea).
function buscarBase(tipoBisagra, { color, costado } = {}) {
    if (tipoBisagra === 'KABI' || tipoBisagra === 'HAVA') return null;
    return buscarExtra({ familia: 'Base', tipoBisagra, color, costado });
}

// (5) Mecanizado por código exacto (VV.MEC.B bisagra extra, VV.MEC.T tirador).
function buscarMecanizado(codigo) {
    return buscarExtra({ familia: 'Mecanizado', codigoExacto: codigo });
}

// (6) Tirador. Prefijo modelo (79971/7997/7794) + Acabado.
//     Precio de línea = tarifa tirador + mecanizado tirador (VV.MEC.T).
//     El código del mecanizado NO se muestra; solo suma al importe.
function buscarTirador(tiradorTipo, acabadoCodigo) {
    const tir = buscarExtra({ familia: 'Tirador', codigoPrefijo: tiradorTipo, acabado: acabadoCodigo });
    if (!tir.encontrado) return tir;
    if (tir.consultar) return tir;   // repintable/ESP → sin precio, no se suma mecanizado
    const mec = buscarMecanizado('VV.MEC.T');
    const precioMec = (mec.encontrado && !mec.consultar) ? mec.tarifa : 0;
    return { ...tir, tarifa: tir.tarifa + precioMec, tarifaMecanizado: precioMec };
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
    // Lado del mecanizado de bisagra = mano (dónde van las bisagras).
    const lado = fabState.mano === 'izquierda' ? 'Izquierdo'
               : fabState.mano === 'derecha'   ? 'Derecho'
               : '';
    const ladoTxt = lado ? ` - lado ${lado}` : '';

    const bisagrasTxt = state.sinMecanizado
        ? `${state.bisagrasTotal} Mecanizados de Bisagra (sin mecanizar)${ladoTxt}`
        : `${state.bisagrasTotal} Mecanizados de Bisagra${ladoTxt}`;

    const partes = [
        `Medidas: ${state.anchoReal} x ${state.alturaReal} mm`
    ];

    // El vidrio solo se pide (y por tanto se acota) si es montado.
    if (state.vidrioMontado === true) {
        partes.push(`Vidrio: ${state.vidrioAncho} x ${state.vidrioAlto} mm`);
    }

    partes.push(bisagrasTxt);
    return partes.join(' - ');
}

// ── Cálculo completo del presupuesto ────────────────────────────
function calcularPresupuestoCompleto() {
    const m = CONFIG.modelos[state.modelo];
    const grupoAcabado = CONFIG.acabados[state.acabado].grupoPrecio;
    const grupoVidrio  = state.vidrioMontado
        ? CONFIG.coloresVidrio[state.colorVidrio].grupoPrecio
        : 'SINVIDRIO';

    const r = {
        grupoAcabado,
        grupoVidrio,
        cantidad:  state.cantidad,   // nº de vitrinas
        lineas:    [],               // cada línea: { codigo, denom, cantidad, precioUnit, importe, dto, consultar, tipo }
        consultar: false,            // true si alguna línea de la vitrina obliga a consultar
        total:     0
    };

    const nVitrinas = state.cantidad;

    // Helper para añadir línea. importe = precioUnit × cantidad (o null si consultar).
    const addLinea = (o) => {
        const consultar = !!o.consultar;
        const precioUnit = consultar ? null : (o.precioUnit || 0);
        const importe = consultar ? null : precioUnit * o.cantidad;
        if (consultar) r.consultar = true;
        r.lineas.push({
            tipo:       o.tipo,
            codigo:     o.codigo || '',
            denom:      o.denom || '',
            cantidad:   o.cantidad,
            precioUnit,
            importe,
            dto:        o.dto || 0,
            consultar,
            copia:      o.copia !== undefined ? o.copia : (o.codigo || '')
        });
        if (importe) r.total += importe;
    };

    // ── (1) VITRINA (core) ──────────────────────────────────
    if (grupoAcabado === 'CONSULTAR') {
        addLinea({ tipo: 'vitrina', codigo: componerCodigo(), denom: componerDenominacion(),
                   cantidad: nVitrinas, consultar: true });
    } else if (grupoVidrio === 'CONSULTAR') {
        addLinea({ tipo: 'vitrina', codigo: componerCodigo(), denom: componerDenominacion(),
                   cantidad: nVitrinas, consultar: true });
    } else {
        const t = buscarTarifa(state.modelo, grupoAcabado, grupoVidrio, state.anchoReal, state.alturaReal);
        addLinea({ tipo: 'vitrina', codigo: componerCodigo(), denom: componerDenominacion(),
                   cantidad: nVitrinas, precioUnit: t.consultar ? 0 : t.tarifa, consultar: t.consultar });
        r.escalon = t.escalon || '';
    }

    // ── (2) OBSERVACIONES (informativa, sin precio ni cantidad) ──
    r.observaciones = componerObservaciones();

    // ── (3)(4)(5) MECANIZADO EXTRA / BISAGRAS / BASE ────────
    // Orden en el grid: mecanizado extra → bisagra → base.
    // ── (3) MECANIZADO BISAGRA EXTRA (VV.MEC.B) ─────────────
    // Independiente de comprar bisagras: puede haber mecanizado extra
    // sin adjuntar bisagras. Se muestra siempre que haya extras.
    if (state.bisagrasExtras > 0) {
        const mec = buscarMecanizado('VV.MEC.B');
        const cantMec = state.bisagrasExtras * nVitrinas;
        if (!mec.encontrado) {
            addLinea({ tipo: 'mecanizado', codigo: 'VV.MEC.B',
                       denom: 'Mecanizado bisagra extra', cantidad: cantMec, consultar: true });
        } else {
            addLinea({ tipo: 'mecanizado', codigo: mec.codigo, denom: mec.denominacion,
                       cantidad: cantMec, precioUnit: mec.tarifa, consultar: mec.consultar });
        }
    }

    // ── (4)(5) BISAGRA / BASE ───────────────────────────────
    // Solo si se adjuntan bisagras como artículo.
    if (state.adjuntarBisagras === true) {
        const tipoBis = m.tipobisagra;
        const esFija  = tipoBis === 'KABI' || tipoBis === 'HAVA';

        // (4) Bisagra
        const bis = esFija
            ? buscarBisagra(tipoBis, { acabado: state.acabado })
            : buscarBisagra(tipoBis, { montaje: fabState.bisMontaje, color: fabState.bisColor });

        const cantBisagras = state.bisagrasTotal * nVitrinas;
        if (!bis.encontrado) {
            addLinea({ tipo: 'bisagra', denom: 'Bisagra ' + tipoBis + ' (sin tarifa)',
                       cantidad: cantBisagras, consultar: true });
        } else {
            addLinea({ tipo: 'bisagra', codigo: bis.codigo, denom: bis.denominacion,
                       cantidad: cantBisagras, precioUnit: bis.tarifa,
                       dto: bis.dto, consultar: bis.consultar });
        }

        // (5) Base (KABI/HAVA → null, sin línea)
        const base = buscarBase(tipoBis, { color: fabState.bisColor, costado: fabState.bisBase });
        if (base) {
            if (!base.encontrado) {
                addLinea({ tipo: 'base', denom: 'Base bisagra (sin tarifa)',
                           cantidad: cantBisagras, consultar: true });
            } else {
                addLinea({ tipo: 'base', codigo: base.codigo, denom: base.denominacion,
                           cantidad: cantBisagras, precioUnit: base.tarifa,
                           dto: base.dto, consultar: base.consultar });
            }
        }
    }

    // ── (6) TIRADOR (1 por vitrina; precio ya incluye VV.MEC.T) ──
    if (state.tirador && state.tiradorTipo) {
        const acabadoCodigo = CONFIG.acabados[state.acabado].codigo;
        const tir = buscarTirador(state.tiradorTipo, acabadoCodigo);
        if (!tir.encontrado) {
            addLinea({ tipo: 'tirador',
                       denom: 'Tirador ' + CONFIG.tiradores[state.tiradorTipo].medidas + ' (sin tarifa)',
                       cantidad: nVitrinas, consultar: true });
        } else {
            addLinea({ tipo: 'tirador', codigo: tir.codigo, denom: tir.denominacion,
                       cantidad: nVitrinas, precioUnit: tir.tarifa, consultar: tir.consultar });
        }
    }

    return r;
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

    mostrarVista('presu');
}

// Atrás desde presupuesto → vuelve a fabricación en el mismo estado.
// mostrarVista solo muestra/oculta: no re-renderiza ni resetea fabState,
// por lo que las selecciones de fabricación permanecen intactas.
function volverDePresupuesto() {
    mostrarVista('fab');
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
        (state.numPedido ? dato('Nº Pedido', state.numPedido) : '') +
        (state.cliente ? dato('Cliente / Ref.', state.cliente) : '') +
        dato('Modelo', state.modelo + ' — ' + m.nombre) +
        dato('Acabado', a.nombre) +
        dato('Medidas vitrina', state.anchoReal + ' × ' + state.alturaReal + ' mm') +
        dato('Medida vidrio', state.vidrioAncho + ' × ' + state.vidrioAlto + ' mm') +
        dato('Vidrio montado', state.vidrioMontado ? 'Sí — ' + CONFIG.coloresVidrio[state.colorVidrio].nombre : 'No') +
        dato('Bisagras', state.bisagrasTotal + (state.sinMecanizado ? ' (sin mecanizar)' : (state.bisagrasExtras > 0 ? ' (' + state.bisagrasExtras + ' extra)' : ''))) +
        dato('Tirador', state.tirador && state.tiradorTipo ? CONFIG.tiradores[state.tiradorTipo].medidas : 'No') +
        dato('Cantidad', state.cantidad + ' ud.');

    // Artículos: recorre r.lineas[]. Cada línea con botón de copia del código.
    const btnCopia = (valor) =>
        `<button type="button" class="btn-copia" data-copia="${String(valor).replace(/"/g, '&quot;')}"
                 title="Copiar" data-html2canvas-ignore>📋</button>`;

    const celPrecio = (l) => l.consultar
        ? '<span class="incluido">consultar</span>'
        : fmtEur(l.importe);

    let filas = '';
    for (const l of r.lineas) {
        const dtoTxt = l.dto ? ` <span class="dto-badge">Dto ${l.dto}%</span>` : '';
        filas += `<tr>
            <td class="copia" data-html2canvas-ignore>${l.codigo ? btnCopia(l.copia) : ''}</td>
            <td class="cod">${l.codigo}</td>
            <td>${l.denom}${dtoTxt}</td>
            <td class="num">${l.cantidad}</td>
            <td class="num">${celPrecio(l)}</td>
        </tr>`;

        // Observaciones: van justo tras la línea de vitrina, ligadas a ella.
        if (l.tipo === 'vitrina' && r.observaciones) {
            filas += `<tr class="obs">
                <td class="copia" data-html2canvas-ignore>${btnCopia(r.observaciones)}</td>
                <td></td>
                <td colspan="3">${r.observaciones}</td>
            </tr>`;
        }
    }

    document.getElementById('presuArticulos').innerHTML = filas;

    // Total o CONSULTAR
    const motivoEl = document.getElementById('presuMotivo');
    if (r.consultar) {
        document.getElementById('presuTotal').textContent = 'CONSULTAR';
        motivoEl.textContent = 'Alguna línea requiere consulta de precio.';
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

        const fechaArch = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
        const nombrePDF = state.numPedido
            ? `Presupuesto-${state.numPedido}${state.cliente ? '-' + state.cliente : ''}-${fechaArch}.pdf`
            : `Vitrina_${state.modelo}_${state.anchoReal}x${state.alturaReal}.pdf`;
        pdf.save(nombrePDF);
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

    // Botón "Presupuesto" del header de fabricación.
    // El estado disabled lo gestiona fabricacion.js (actualizarEstadoPDF)
    // según la captura de bisagras.
    document.getElementById('fabBtnPresupuesto')
        ?.addEventListener('click', mostrarPresupuesto);
});
