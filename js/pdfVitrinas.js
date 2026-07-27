// ============================================
// PDF VITRINAS — Generador nativo jsPDF
// ============================================

// ── MODAL POPUP ─────────────────────────────
function mostrarModalPDF() {
    // Eliminar modal previo si existe
    const prev = document.getElementById('pdfModal');
    if (prev) prev.remove();

    const overlay = document.createElement('div');
    overlay.id = 'pdfModal';
    overlay.style.cssText = `
        position:fixed; inset:0; z-index:10000;
        background:rgba(0,0,0,0.5);
        display:flex; align-items:center; justify-content:center;
        animation: pdfFadeIn 0.2s ease-out;
    `;

    overlay.innerHTML = `
        <style>
            @keyframes pdfFadeIn { from{opacity:0} to{opacity:1} }
            @keyframes pdfSlideIn { from{transform:translateY(-20px);opacity:0} to{transform:translateY(0);opacity:1} }
        </style>
        <div style="
            background:white; border-radius:10px; padding:28px 32px;
            width:420px; max-width:90vw;
            box-shadow:0 10px 40px rgba(0,0,0,0.3);
            animation: pdfSlideIn 0.25s ease-out;
            font-family:'Segoe UI',system-ui,sans-serif;
        ">
            <h3 style="margin:0 0 18px; color:#2c3e50; font-size:1.1rem; font-weight:600;">
                📄 Datos para el informe PDF
            </h3>

            <label style="display:block; margin-bottom:5px; font-size:0.85rem; font-weight:600; color:#2c3e50;">
                Nº Pedido
            </label>
            <input type="text" id="pdfPedido" placeholder="Ej: S2200" style="
                width:100%; padding:10px 12px; border:2px solid #e0e0e0; border-radius:6px;
                font-size:0.95rem; margin-bottom:14px; outline:none;
                transition:border-color 0.2s;
            " onfocus="this.style.borderColor='#3498db'" onblur="this.style.borderColor='#e0e0e0'">

            <label style="display:block; margin-bottom:5px; font-size:0.85rem; font-weight:600; color:#2c3e50;">
                Cliente / Referencia
            </label>
            <input type="text" id="pdfCliente" placeholder="Ej: Carpintería Martínez" style="
                width:100%; padding:10px 12px; border:2px solid #e0e0e0; border-radius:6px;
                font-size:0.95rem; margin-bottom:22px; outline:none;
                transition:border-color 0.2s;
            " onfocus="this.style.borderColor='#3498db'" onblur="this.style.borderColor='#e0e0e0'">

            <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button id="pdfCancelar" style="
                    padding:10px 22px; border:2px solid #ddd; border-radius:6px;
                    background:white; color:#666; font-size:0.9rem; font-weight:600;
                    cursor:pointer; transition:all 0.2s;
                " onmouseover="this.style.borderColor='#e74c3c';this.style.color='#e74c3c'"
                  onmouseout="this.style.borderColor='#ddd';this.style.color='#666'">
                    Cancelar
                </button>
                <button id="pdfGenerar" style="
                    padding:10px 22px; border:none; border-radius:6px;
                    background-image:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                    color:white; font-size:0.9rem; font-weight:600;
                    cursor:pointer; transition:all 0.2s;
                " onmouseover="this.style.opacity='0.85';this.style.transform='translateY(-1px)'"
                  onmouseout="this.style.opacity='1';this.style.transform='translateY(0)'">
                    Generar PDF
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Cerrar al clicar fuera
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.getElementById('pdfCancelar').addEventListener('click', () => overlay.remove());
    document.getElementById('pdfGenerar').addEventListener('click', () => {
        const pedido  = document.getElementById('pdfPedido').value.trim();
        const cliente = document.getElementById('pdfCliente').value.trim();
        overlay.remove();
        generarPDFVitrinas(pedido, cliente);
    });

    // Focus al primer campo
    setTimeout(() => document.getElementById('pdfPedido').focus(), 100);
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
        const mL = 14, mR = 14;
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

        // ── CABECERA AZUL ──
        pdf.setFillColor(44, 62, 80);
        pdf.rect(0, 0, W, 16, 'F');

        // Logo Adinor
        const logoUrl = 'https://raw.githubusercontent.com/Jdurba/Vitrinas/main/Imagenes/LogoAdinorBlanco.png';
        const logoData = await cargarImagenComoData(logoUrl);
        if (logoData) {
            const logoFit = fitImageInBox(logoData.naturalWidth, logoData.naturalHeight, 36, 12);
            pdf.addImage(logoData.dataUrl, 'PNG', mL + logoFit.offsetX, 2 + logoFit.offsetY, logoFit.w, logoFit.h);
        } else {
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('ADINOR', mL + 2, 10.5);
        }

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Hoja de preparación de vitrinas de aluminio', W / 2, 10.5, { align: 'center' });
        y = 22;

        // ── CAMPOS ──
        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');

        const campoIzq = mL;
        const campoDer = W / 2 + 5;

        function campoPDF(x, yy, label, valor) {
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(120, 120, 120);
            pdf.text(label, x, yy);
            if (valor) {
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(30, 30, 30);
                pdf.text(valor, x + 28, yy);
            }
            // Línea bajo el valor
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.3);
            pdf.line(x + 27, yy + 1, x + 80, yy + 1);
        }

        campoPDF(campoIzq, y,     'Fecha',         fecha);
        campoPDF(campoDer, y,      'Nº Pedido',     pedido);
        campoPDF(campoIzq, y + 7,  'Cliente / Ref.', cliente);
        campoPDF(campoDer, y + 7,  'Cantidad',      `${state.cantidad} unidad${state.cantidad > 1 ? 'es' : ''}`);
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
        pdf.setTextColor(44, 62, 80);
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

        y += imgBoxH + 6;

        // ── LÍNEA SEPARADORA ──
        pdf.setDrawColor(220); pdf.setLineWidth(0.4);
        pdf.line(mL, y, W - mR, y);
        y += 5;

        // ═══════════════════════════════════════
        // DOS COLUMNAS: izquierda (tablas) | derecha (SVGs)
        // ═══════════════════════════════════════
        const colIzqW = contentW - 72;  // ~110mm
        const colDerW = 68;             // para SVGs
        const colDerX = mL + colIzqW + 4;
        const yStartCols = y;

        // ── COL IZQ: Tabla dimensiones puerta ──
        pdf.setFillColor(44, 62, 80);
        pdf.rect(mL, y, colIzqW, 5, 'F');
        pdf.setTextColor(255); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
        pdf.text('DIMENSIONES DE LA PUERTA', mL + 3, y + 3.5);
        y += 7;

        // Tabla simple 1 fila
        const tblX = mL;
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

        // ── COL IZQ: Tabla vidrio ──
        if (tieneVidrio) {
            pdf.setFillColor(44, 62, 80);
            pdf.rect(mL, y, colIzqW, 5, 'F');
            pdf.setTextColor(255); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
            pdf.text('DIMENSIONES DEL VIDRIO', mL + 3, y + 3.5);
            y += 7;

            pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(60);
            pdf.setFillColor(232, 232, 232);
            pdf.rect(tblX, y, 27, 5, 'FD'); pdf.rect(tblX + 27, y, 27, 5, 'FD'); pdf.rect(tblX + 54, y, 27, 5, 'FD');
            pdf.text('Descuento', tblX + 13.5, y + 3.5, { align: 'center' });
            pdf.text('Alto vidrio', tblX + 40.5, y + 3.5, { align: 'center' });
            pdf.text('Ancho vidrio', tblX + 67.5, y + 3.5, { align: 'center' });
            y += 5;

            pdf.setFillColor(238, 246, 255);
            pdf.rect(tblX, y, 27, 5.5, 'FD'); pdf.rect(tblX + 27, y, 27, 5.5, 'FD'); pdf.rect(tblX + 54, y, 27, 5.5, 'FD');
            pdf.setFont('helvetica', 'normal'); pdf.setTextColor(60);
            const descAlt = m?.DescV_Alt || 0;
            const descAnc = m?.DescV_Anc || 0;
            const descTxt = descAlt === descAnc ? `-${descAlt} mm` : `-${descAlt}/-${descAnc} mm`;
            pdf.text(descTxt, tblX + 13.5, y + 4, { align: 'center' });
            pdf.setTextColor(194, 34, 34); pdf.setFont('helvetica', 'bold');
            pdf.text(String(vidrioAltura), tblX + 40.5, y + 4, { align: 'center' });
            pdf.text(String(vidrioAncho),  tblX + 67.5, y + 4, { align: 'center' });
            y += 8;
        }

        // ── COL IZQ: Bisagras ──
        const manoTexto = fabState.mano === 'izquierda' ? 'Mano izquierda' : 'Mano derecha';
        pdf.setFillColor(44, 62, 80);
        pdf.rect(mL, y, colIzqW, 5, 'F');
        pdf.setTextColor(255); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
        pdf.text(`BISAGRAS — ${manoTexto.toUpperCase()}`, mL + 3, y + 3.5);
        y += 7;

        // Nº bisagras
        pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(60);
        pdf.setFillColor(232, 232, 232);
        pdf.rect(tblX, y, 54, 5, 'FD');
        pdf.text(`Nº Bisagras: ${n}`, tblX + 27, y + 3.5, { align: 'center' });
        y += 6;

        if (!bisagrasFijas) {
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
            pdf.text(String(fabState.b1), tblX + 30.5, y + 3.5, { align: 'center' });
            pdf.text(String(mecanizado[0]), tblX + 55.5, y + 3.5, { align: 'center' });
            y += 5;

            // Filas: C1..Cn
            for (let i = 0; i < allCs.length; i++) {
                pdf.rect(tblX, y, 18, 5, 'D'); pdf.rect(tblX + 18, y, 25, 5, 'D'); pdf.rect(tblX + 43, y, 25, 5, 'D');
                pdf.text(`C${i + 1}`, tblX + 9, y + 3.5, { align: 'center' });
                pdf.text(String(Math.round(allCs[i])), tblX + 30.5, y + 3.5, { align: 'center' });
                pdf.text(String(Math.round(mecanizado[i + 1])), tblX + 55.5, y + 3.5, { align: 'center' });
                y += 5;
            }

            // B2
            pdf.rect(tblX, y, 18, 5, 'D'); pdf.rect(tblX + 18, y, 25, 5, 'D'); pdf.rect(tblX + 43, y, 25, 5, 'D');
            pdf.text('B2', tblX + 9, y + 3.5, { align: 'center' });
            pdf.text(String(fabState.b2), tblX + 30.5, y + 3.5, { align: 'center' });
            pdf.text('—', tblX + 55.5, y + 3.5, { align: 'center' });
            y += 7;
        } else {
            pdf.setFontSize(8); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(120);
            pdf.text('Posición de bisagras fija para este perfil', mL + 3, y + 3);
            y += 7;
        }

        // ── COL IZQ: Tirador ──
        if (tieneTirador) {
            pdf.setFillColor(44, 62, 80);
            pdf.rect(mL, y, colIzqW, 5, 'F');
            pdf.setTextColor(255); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
            pdf.text('TIRADOR MECANIZADO', mL + 3, y + 3.5);
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
            pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(44, 62, 80);
            pdf.text(`Tirador ${tirador?.medidas || state.tiradorTipo}`, tDatosX, y + 5);

            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(60);
            const posLabel = fabState.tiradorPos === 'opuesto'
                ? `Opuesto (${fabState.mano === 'izquierda' ? 'derecha' : 'izquierda'})`
                : fabState.tiradorPos;
            pdf.text(`Posición: ${posLabel}`, tDatosX, y + 10.5);

            pdf.setFont('helvetica', 'bold'); pdf.setTextColor(194, 34, 34);
            pdf.text(`Medida Z: ${fabState.tiradorZ} mm`, tDatosX, y + 16);

            y += tBoxH + 4;
        } else {
            // ── Sin tirador: aviso en columna izquierda, estilo normal ──
            pdf.setFillColor(44, 62, 80);
            pdf.rect(mL, y, colIzqW, 5, 'F');
            pdf.setTextColor(255); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
            pdf.text('TIRADOR MECANIZADO', mL + 3, y + 3.5);
            y += 7;

            pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(44, 62, 80);
            pdf.text('Sin tirador mecanizado', mL + 3, y + 4);
            y += 8;
        }

        // ── COLUMNA DERECHA: SVGs ──
        // Capturar ambos SVGs del DOM
        const svgTrasImg  = await svgToImage('fabSvgTrasera', 400, 560);
        const svgFrontImg = await svgToImage('fabSvgFrontal', 400, 560);

        const svgW = colDerW;
        const svgTraseraH = 95;
        const svgFrontalH = 80;

        if (svgTrasImg) {
            pdf.addImage(svgTrasImg, 'PNG', colDerX, yStartCols, svgW, svgTraseraH);
        } else {
            pdf.setDrawColor(200); pdf.setFillColor(252, 252, 252);
            pdf.rect(colDerX, yStartCols, svgW, svgTraseraH, 'FD');
            pdf.setFontSize(8); pdf.setTextColor(170);
            pdf.text('Vista Trasera', colDerX + svgW / 2, yStartCols + svgTraseraH / 2, { align: 'center' });
        }
        pdf.setFontSize(6.5); pdf.setTextColor(150);
        pdf.text('Vista trasera — bisagras', colDerX + svgW / 2, yStartCols + svgTraseraH + 3, { align: 'center' });

        const svgFrontY = yStartCols + svgTraseraH + 7;
        if (svgFrontImg) {
            pdf.addImage(svgFrontImg, 'PNG', colDerX, svgFrontY, svgW, svgFrontalH);
        } else {
            pdf.setDrawColor(200); pdf.setFillColor(252, 252, 252);
            pdf.rect(colDerX, svgFrontY, svgW, svgFrontalH, 'FD');
            pdf.setFontSize(8); pdf.setTextColor(170);
            pdf.text('Vista Frontal', colDerX + svgW / 2, svgFrontY + svgFrontalH / 2, { align: 'center' });
        }
        pdf.setFontSize(6.5); pdf.setTextColor(150);
        pdf.text(tieneTirador ? 'Vista frontal — tirador' : 'Vista frontal', colDerX + svgW / 2, svgFrontY + svgFrontalH + 3, { align: 'center' });

        // Badge "SIN TIRADOR" sobre el dibujo frontal cuando no hay tirador
        if (!tieneTirador) {
            const badgeW = 30, badgeH = 6;
            const badgeX = colDerX + (svgW - badgeW) / 2;
            const badgeY = svgFrontY + (svgFrontalH - badgeH) / 2;
            pdf.setFillColor(194, 34, 34);
            pdf.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, 'F');
            pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255);
            pdf.text('SIN TIRADOR', badgeX + badgeW / 2, badgeY + 4.2, { align: 'center' });
        }

        // ── PIE DE PÁGINA ──
        pdf.setDrawColor(220); pdf.setLineWidth(0.3);
        pdf.line(mL, H - 12, W - mR, H - 12);
        pdf.setFontSize(6.5); pdf.setTextColor(170);
        pdf.text('ADINOR — Configurador de Vitrinas', mL, H - 8);
        pdf.text(`Generado: ${fecha}`, W - mR, H - 8, { align: 'right' });

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

    // Activar el botón (quitar estado deshabilitado)
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.title = 'Generar PDF de fabricación';

    // Quitar listener previo y poner el nuevo
    const clone = btn.cloneNode(true);
    clone.style.opacity = '1';
    clone.style.cursor = 'pointer';
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', mostrarModalPDF);
}

document.addEventListener('DOMContentLoaded', inicializarPDFVitrinas);
