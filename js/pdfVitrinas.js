// ============================================
// PDF VITRINAS — Generador nativo jsPDF
// ============================================

// ── DISPARADOR PDF ──────────────────────────
// Cliente y Nº Pedido se recogen en el formulario (state), no en modal.
function mostrarModalPDF() {
    generarPDFVitrinas(state.numPedido || '', state.cliente || '');
}

// ── CONVERTIR SVG del DOM a imagen PNG (dataURL) ─────
function svgToImage(svgContainerId, width, height) {
    return new Promise((resolve) => {
        const container = document.getElementById(svgContainerId);
        if (!container) return resolve(null);

        const svgEl = container.querySelector('svg');
        if (!svgEl) return resolve(null);

        const clone = svgEl.cloneNode(true);
        clone.setAttribute('width', width);
        clone.setAttribute('height', height);

        const svgData = new XMLSerializer().serializeToString(clone);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2;   // 2x para nitidez
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d');
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        img.src = url;
    });
}

// ── CARGAR IMAGEN EXTERNA COMO DATAURL ───────────────
// Devuelve { dataUrl, naturalWidth, naturalHeight } o null
function cargarImagenComoData(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try {
                resolve({
                    dataUrl: canvas.toDataURL('image/png'),
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight
                });
            } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

// ── AJUSTAR IMAGEN PROPORCIONALMENTE DENTRO DE UN RECUADRO ──
// Devuelve { w, h, x, y } para centrar la imagen dentro del box
function fitImageInBox(naturalW, naturalH, maxW, maxH) {
    const ratio = Math.min(maxW / naturalW, maxH / naturalH);
    const w = naturalW * ratio;
    const h = naturalH * ratio;
    // Centrar dentro del recuadro
    const x = (maxW - w) / 2;
    const y = (maxH - h) / 2;
    return { w, h, offsetX: x, offsetY: y };
}

// ── GENERADOR PRINCIPAL ──────────────────────────────
async function generarPDFVitrinas(pedido, cliente) {
    const btn = document.getElementById('fabBtnPDF');
    if (btn) { btn.textContent = '⏳ Generando...'; btn.style.pointerEvents = 'none'; }

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const W = 210, H = 297;
        const mL = 14, mR = 14, mB = 12;
        const contentW = W - mL - mR;
        let y = 0; // cursor vertical

        // ── Datos ──
        const m     = CONFIG.modelos[state.modelo];
        const a     = CONFIG.acabados[state.acabado];
        const fecha = new Date().toLocaleDateString('es-ES');
        const tieneTirador  = state.tirador && state.tiradorTipo;
        const tieneVidrio   = state.vidrioMontado;
        const n             = state.bisagrasTotal;
        const bisagrasFijas = !!m?.bisagras_fijas;
        const sinMec        = state.sinMecanizado;

        // Medidas vidrio (calculadas en configurador.js → calcularVidrio)
        const vidrioAltura = state.vidrioAlto;
        const vidrioAncho  = state.vidrioAncho;

        // Mecanizado (acumulado)
        const cn    = calcularCn();
        const allCs = n > 1 ? [...fabState.csEditables, cn] : [];
        const mecanizado = [];
        let acum = fabState.b1;
        mecanizado.push(acum); // B1
        for (const c of allCs) {
            acum += c;
            mecanizado.push(acum);
        }

        // ¿Reparto equidistante original? Detección autónoma (no depende de fabricacion.js):
        // equidistante ≡ B1/B2 en su valor por defecto Y todas las C iguales entre sí
        // (Cn puede diferir 1 céntimo por el redondeo del reparto).
        let esEquidistante = false;
        if (n > 1) {
            const B1def = (CONFIG.bisagras_B1_defecto ?? CONFIG.bisagras_B_minimo ?? 100);
            const B2def = (CONFIG.bisagras_B2_defecto ?? CONFIG.bisagras_B_minimo ?? 100);
            const igual = (a, b) => Math.abs(a - b) < 0.02;
            const bOk = igual(fabState.b1, B1def) && igual(fabState.b2, B2def);

            // allCs = [C1..Cn-1 editables, Cn]. Las editables deben ser iguales entre sí;
            // Cn puede diferir por el redondeo del reparto (absorbe el resto).
            let csUniformes = true;
            const editables = fabState.csEditables;
            if (editables.length > 0) {
                const ref = editables[0];
                for (const c of editables) {
                    if (Math.abs(c - ref) > 0.02) { csUniformes = false; break; }
                }
                // Cn (último de allCs) puede desviarse hasta ~0,5 mm por redondeo acumulado
                const cnVal = allCs[allCs.length - 1];
                if (Math.abs(cnVal - ref) > 0.5) csUniformes = false;
            }
            esEquidistante = bOk && csUniformes;
        }

        // ── CABECERA (estilo A4 presupuesto: fondo blanco + borde inferior) ──
        const AZUL = [45, 58, 75];   // #2D3A4B

        // Logo Adinor (versión negra del ecosistema)
        const logoUrl = 'https://jdurba.github.io/General/img/LOGO_2025_Negro.png';
        const logoData = await cargarImagenComoData(logoUrl);
        if (logoData) {
            const logoFit = fitImageInBox(logoData.naturalWidth, logoData.naturalHeight, 34, 13);
            pdf.addImage(logoData.dataUrl, 'PNG', mL + logoFit.offsetX, 8 + logoFit.offsetY, logoFit.w, logoFit.h);
        } else {
            pdf.setTextColor(...AZUL);
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('ADINOR', mL, 15);
        }

        pdf.setTextColor(...AZUL);
        pdf.setFontSize(15);
        pdf.setFont('helvetica', 'bold');
        // Centrado en el espacio entre el logo y el margen derecho
        const tituloLeft = mL + 34 + 6;   // fin del logo (ancho 34) + holgura
        const tituloCentro = tituloLeft + (W - mR - tituloLeft) / 2;
        pdf.text('HOJA DE PREPARACIÓN DE VITRINAS', tituloCentro, 14, { align: 'center' });

        // Borde inferior de cabecera (fina y separada del logo)
        pdf.setDrawColor(...AZUL);
        pdf.setLineWidth(0.4);
        pdf.line(mL, 23, W - mR, 23);
        y = 31;

        // Helper: barra de sección estilo A4 (gris con texto oscuro mayúsculas)
        function seccion(texto, xx, ancho, yy) {
            pdf.setFillColor(215, 216, 214);   // #d7d8d6
            pdf.setDrawColor(183, 184, 182);   // #b7b8b6
            pdf.setLineWidth(0.3);
            pdf.rect(xx, yy, ancho, 5.5, 'FD');
            pdf.setTextColor(51, 51, 51);      // #333
            pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
            pdf.text(texto.toUpperCase(), xx + 3, yy + 3.8);
        }

        // ── CAMPOS ──
        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');

        const campoIzq = mL;
        const campoDer = W / 2 + 5;

        // gapLabel: separación etiqueta→valor; anchoLinea: largo del subrayado desde el valor
        function campoPDF(x, yy, label, valor, gapLabel, anchoLinea) {
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(120, 120, 120);
            pdf.text(label, x, yy);
            const valX = x + gapLabel;
            if (valor) {
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(30, 30, 30);
                pdf.text(valor, valX, yy);
            }
            // Línea bajo el valor, pegada a la etiqueta
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.3);
            pdf.line(valX - 1, yy + 1, valX + anchoLinea, yy + 1);
        }

        // Izquierda: Nº Pedido / Cliente (bloque más largo). Derecha: Fecha / Cantidad.
        campoPDF(campoIzq, y,      'Nº Pedido', pedido,  20, 68);
        campoPDF(campoDer, y,      'Fecha',     fecha,   20, 45);
        campoPDF(campoIzq, y + 7,  'Cliente',   cliente, 20, 68);
        campoPDF(campoDer, y + 7,  'Cantidad',  `${state.cantidad} unidad${state.cantidad > 1 ? 'es' : ''}`, 20, 45);
        y += 16;

        // ── PERFIL + ACABADO (texto) ──
        // Intentar cargar imagen del perfil
        const perfilUrl = `https://raw.githubusercontent.com/Jdurba/Vitrinas/main/Imagenes/${m?.imagen || state.modelo}_cotas.jpg`;
        const perfilImg = await cargarImagenComoData(perfilUrl);

        const imgBoxW = 52, imgBoxH = 26;
        if (perfilImg) {
            const fit = fitImageInBox(perfilImg.naturalWidth, perfilImg.naturalHeight, imgBoxW, imgBoxH);
            pdf.addImage(perfilImg.dataUrl, 'PNG', mL + fit.offsetX, y + fit.offsetY, fit.w, fit.h);
        } else {
            pdf.setDrawColor(200); pdf.setFillColor(245, 245, 245);
            pdf.rect(mL, y, imgBoxW, imgBoxH, 'FD');
            pdf.setFontSize(7); pdf.setTextColor(160);
            pdf.text('Imagen perfil', mL + imgBoxW / 2, y + imgBoxH / 2, { align: 'center' });
        }

        const datosX = mL + imgBoxW + 8;
        pdf.setFontSize(10);
        pdf.setTextColor(...AZUL);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Perfil: ${state.modelo} — ${m?.nombre || ''}`, datosX, y + 6);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Acabado: ${a?.nombre || '—'}`, datosX, y + 12);

        let vidrioTexto = 'No';
        if (tieneVidrio) {
            vidrioTexto = 'Sí';
            if (state.colorVidrio) vidrioTexto += ` — ${formatearColorVidrio(state.colorVidrio)}`;
        }
        pdf.text(`Vidrio: ${vidrioTexto}`, datosX, y + 18);

        // Medidas del vidrio real (alto × ancho), como línea suelta (no tabla)
        if (tieneVidrio) {
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(...AZUL);
            pdf.text(`Medidas vidrio: ${vidrioAltura} × ${vidrioAncho} mm`, datosX, y + 24);
        }

        y += imgBoxH + 6;

        // ── LÍNEA SEPARADORA ──
        pdf.setDrawColor(...AZUL); pdf.setLineWidth(0.3);
        pdf.line(mL, y, W - mR, y);
        y += 5;

        // ═══════════════════════════════════════
        // ÁREA BAJO CABECERA: dos bloques iguales
        //   Bloque 2 (Bisagras): puerta + grid | vista trasera
        //   Bloque 3 (Tirador):  texto tirador | vista frontal
        // ═══════════════════════════════════════
        const colIzqW = contentW - 72;  // ~110mm
        const colDerW = 68;             // para SVGs
        const colDerX = mL + colIzqW + 4;

        const areaTop = y;              // inicio del área (tras separador)
        const areaBottom = H - mB;      // sin pie: hasta el margen inferior
        const bloqueAlto = (areaBottom - areaTop) / 2;
        const bloque2Top = areaTop;
        const bloque3Top = areaTop + bloqueAlto;
        const yStartCols = areaTop;

        // ── COL IZQ: Tabla dimensiones puerta ──
        seccion('Dimensiones de la puerta', mL, colIzqW, y);
        y += 7;

        // Tablas indentadas respecto a la barra de sección (sangría)
        const SANGRIA = 12;
        const tblX = mL + SANGRIA;
        pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(60);
        pdf.setFillColor(232, 232, 232);
        pdf.rect(tblX, y, 40, 5, 'FD'); pdf.rect(tblX + 40, y, 40, 5, 'FD');
        pdf.text('Altura Y (mm)', tblX + 20, y + 3.5, { align: 'center' });
        pdf.text('Anchura X (mm)', tblX + 60, y + 3.5, { align: 'center' });
        y += 5;
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30);
        pdf.setFillColor(255);
        pdf.rect(tblX, y, 40, 5.5, 'D'); pdf.rect(tblX + 40, y, 40, 5.5, 'D');
        pdf.text(String(state.alturaReal), tblX + 20, y + 4, { align: 'center' });
        pdf.text(String(state.anchoReal),  tblX + 60, y + 4, { align: 'center' });
        y += 8;

        // ── COL IZQ: Bisagras ──
        const manoTexto = fabState.mano === 'izquierda' ? 'Mano izquierda' : 'Mano derecha';
        seccion(`Bisagras — ${manoTexto}`, mL, colIzqW, y);
        y += 7;

        // Nº bisagras
        pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(60);
        pdf.setFillColor(232, 232, 232);
        pdf.rect(tblX, y, 54, 5, 'FD');
        pdf.text(`Nº Bisagras: ${n}`, tblX + 27, y + 3.5, { align: 'center' });
        y += 6;

        if (sinMec) {
            pdf.setFontSize(8); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(120);
            pdf.text('Marco limpio — sin mecanizado de bisagras', mL + 3, y + 3);
            y += 7;
        } else if (!bisagrasFijas) {
            // Cabecera tabla
            pdf.setFillColor(232, 232, 232);
            pdf.rect(tblX, y, 18, 5, 'FD'); pdf.rect(tblX + 18, y, 25, 5, 'FD'); pdf.rect(tblX + 43, y, 25, 5, 'FD');
            pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(60);
            pdf.text('', tblX + 9, y + 3.5, { align: 'center' });
            pdf.text('Medida (mm)', tblX + 30.5, y + 3.5, { align: 'center' });
            pdf.text('Mecanizado', tblX + 55.5, y + 3.5, { align: 'center' });
            y += 5;

            // Filas: B1
            pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30);
            pdf.rect(tblX, y, 18, 5, 'D'); pdf.rect(tblX + 18, y, 25, 5, 'D'); pdf.rect(tblX + 43, y, 25, 5, 'D');
            pdf.text('B1', tblX + 9, y + 3.5, { align: 'center' });
            pdf.text(fmt(fabState.b1), tblX + 30.5, y + 3.5, { align: 'center' });
            pdf.text(fmt(mecanizado[0]), tblX + 55.5, y + 3.5, { align: 'center' });
            y += 5;

            // Filas: C1..Cn
            for (let i = 0; i < allCs.length; i++) {
                pdf.rect(tblX, y, 18, 5, 'D'); pdf.rect(tblX + 18, y, 25, 5, 'D'); pdf.rect(tblX + 43, y, 25, 5, 'D');
                pdf.text(`C${i + 1}`, tblX + 9, y + 3.5, { align: 'center' });
                pdf.text(fmt(allCs[i]), tblX + 30.5, y + 3.5, { align: 'center' });
                pdf.text(fmt(mecanizado[i + 1]), tblX + 55.5, y + 3.5, { align: 'center' });
                y += 5;
            }

            // B2
            pdf.rect(tblX, y, 18, 5, 'D'); pdf.rect(tblX + 18, y, 25, 5, 'D'); pdf.rect(tblX + 43, y, 25, 5, 'D');
            pdf.text('B2', tblX + 9, y + 3.5, { align: 'center' });
            pdf.text(fmt(fabState.b2), tblX + 30.5, y + 3.5, { align: 'center' });
            pdf.text('—', tblX + 55.5, y + 3.5, { align: 'center' });
            y += 6;

            // Nota: reparto equidistante original (solo si no se ha editado ninguna cota)
            if (esEquidistante) {
                pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(34, 139, 58);
                pdf.text('Medidas equidistantes (reparto automático)', tblX, y + 3);
                y += 4;
            }
            y += 1;
        } else {
            pdf.setFontSize(8); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(120);
            pdf.text('Posición de bisagras fija para este perfil', mL + 3, y + 3);
            y += 7;
        }

        // ── COL IZQ: Tirador (arranca en el inicio del bloque 3) ──
        y = bloque3Top;
        if (tieneTirador) {
            seccion('Tirador mecanizado', mL, colIzqW, y);
            y += 7;

            // Imagen tirador
            const tirador = CONFIG.tiradores[state.tiradorTipo];
            const tiradorImg = tirador ? await cargarImagenComoData(tirador.imagen) : null;

            const tBoxW = 36, tBoxH = 17;
            if (tiradorImg) {
                const tFit = fitImageInBox(tiradorImg.naturalWidth, tiradorImg.naturalHeight, tBoxW, tBoxH);
                pdf.addImage(tiradorImg.dataUrl, 'JPEG', mL + tFit.offsetX, y + tFit.offsetY, tFit.w, tFit.h);
            } else {
                pdf.setDrawColor(200); pdf.setFillColor(245, 245, 245);
                pdf.rect(mL, y, tBoxW, tBoxH, 'FD');
                pdf.setFontSize(6); pdf.setTextColor(160);
                pdf.text('Tirador', mL + tBoxW / 2, y + tBoxH / 2, { align: 'center' });
            }

            const tDatosX = mL + tBoxW + 5;
            pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...AZUL);
            pdf.text(`Tirador ${tirador?.medidas || state.tiradorTipo}`, tDatosX, y + 5);

            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(60);
            const posLabel = fabState.tiradorPos === 'opuesto'
                ? `Opuesto (${fabState.mano === 'izquierda' ? 'derecha' : 'izquierda'})`
                : fabState.tiradorPos;
            pdf.text(`Posición: ${posLabel}`, tDatosX, y + 10.5);

            pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 30, 30);
            pdf.text(`Medida Z: ${fabState.tiradorZ} mm`, tDatosX, y + 16);

            y += tBoxH + 4;
        } else {
            // ── Sin tirador: aviso en columna izquierda, estilo normal ──
            seccion('Tirador mecanizado', mL, colIzqW, y);
            y += 7;

            pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...AZUL);
            pdf.text('Sin tirador mecanizado', mL + 3, y + 4);
            y += 8;
        }

        // ── COLUMNA DERECHA: cada vista ocupa su bloque completo ──
        const svgTrasImg  = await svgToImage('fabSvgTrasera', 400, 560);
        const svgFrontImg = await svgToImage('fabSvgFrontal', 400, 560);

        const CAP = 4;              // hueco para el caption bajo cada dibujo
        const GAP = 3;              // margen interno del bloque
        const ratio = 560 / 400;    // alto/ancho del PNG generado

        // Cada imagen ocupa la altura de su bloque (menos caption), anclada arriba
        const altoTrasDisp  = bloqueAlto - CAP - GAP;
        const altoFrontDisp = bloqueAlto - CAP - GAP;

        function dibujarVista(img, yTop, altoDisp, caption) {
            let h = altoDisp;
            let w = h / ratio;
            if (w > colDerW) { w = colDerW; h = w * ratio; }   // limitar por ancho
            const x = colDerX + (colDerW - w) / 2;             // centrar horizontal

            if (img) {
                pdf.addImage(img, 'PNG', x, yTop, w, h);
            } else {
                pdf.setDrawColor(200); pdf.setFillColor(252, 252, 252);
                pdf.rect(x, yTop, w, h, 'FD');
                pdf.setFontSize(8); pdf.setTextColor(170);
                pdf.text(caption, x + w / 2, yTop + h / 2, { align: 'center' });
            }
            pdf.setFontSize(6.5); pdf.setTextColor(150); pdf.setFont('helvetica', 'normal');
            pdf.text(caption, colDerX + colDerW / 2, yTop + h + CAP - 1, { align: 'center' });
        }

        dibujarVista(svgTrasImg, bloque2Top, altoTrasDisp, 'Vista trasera — bisagras');
        dibujarVista(svgFrontImg, bloque3Top, altoFrontDisp, tieneTirador ? 'Vista frontal — tirador' : 'Vista frontal');

        // ── VERSIÓN (traza mínima, sin línea de pie para ganar espacio) ──
        if (window.VERSION_APP) {
            pdf.setFontSize(5.5); pdf.setTextColor(200);
            pdf.text(`Adinor · Vitrinas · ${window.VERSION_APP}`, W - mR, H - 4, { align: 'right' });
        }

        // ── NOMBRE Y DESCARGA ──
        const nombreArchivo = pedido
            ? `Vitrina-${pedido}-${cliente || 'sin-ref'}-${fecha.replace(/\//g, '-')}.pdf`
            : `Vitrina-${fecha.replace(/\//g, '-')}.pdf`;

        pdf.save(nombreArchivo);

    } catch (error) {
        console.error('Error generando PDF:', error);
        aviso(`Error al generar PDF:\n${error.message}`);
    } finally {
        if (btn) {
            btn.textContent = '📄 Generar PDF';
            btn.style.pointerEvents = '';
        }
    }
}

// ── INICIALIZACIÓN ───────────────────────────────────
function inicializarPDFVitrinas() {
    const btn = document.getElementById('fabBtnPDF');
    if (!btn) return;

    // Quitar listener previo y poner el nuevo. El estado disabled lo gestiona
    // fabricacion.js (actualizarEstadoPDF) según la captura de bisagras.
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', mostrarModalPDF);
}

document.addEventListener('DOMContentLoaded', inicializarPDFVitrinas);
