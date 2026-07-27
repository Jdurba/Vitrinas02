// ==========================================
// ESTADO DE FABRICACIÓN
// ==========================================
const fabState = {
    mano:        null,   // 'izquierda' | 'derecha'
    tiradorPos:  null,   // 'opuesto' | 'arriba' | 'abajo'
    tiradorZ:    null,   // mm
    b1:          100,
    b2:          100,
    csEditables: []      // valores de C1, C2, ... Cn-1 (Cn es automático)
};

// ==========================================
// HELPERS DE CÁLCULO
// ==========================================

function calcularCsDefault() {
    const gaps = state.bisagrasTotal - 1;
    if (gaps <= 1) return [];
    const total = state.alturaReal - fabState.b1 - fabState.b2;
    const base  = Math.floor(total / gaps);
    const result = [];
    for (let i = 1; i < gaps; i++) result.push(base);
    return result;
}

// Cn es el valor calculado: absorbe el redondeo y es siempre el último
function calcularCn() {
    const sumCsEdit = fabState.csEditables.reduce((a, b) => a + b, 0);
    return state.alturaReal - fabState.b1 - fabState.b2 - sumCsEdit;
}

function getBisagraPositions() {
    const n = state.bisagrasTotal;
    if (n <= 0) return [];
    const cn    = calcularCn();
    const allCs = n > 1 ? [...fabState.csEditables, cn] : [];  // Cn al final
    const pos   = [fabState.b1];
    for (const c of allCs) pos.push(pos[pos.length - 1] + c);
    return pos;
}

// Posiciones en px para el SVG con B1/B2 fijos (no escalados)
// igual que fr y bisR — el dibujo no es proporcional pero siempre es legible
const B_MIN_PX = 40;  // px mínimos reservados para B1 y B2 en el dibujo

function getBisagraPxPositions(dY, dH) {
    const n = state.bisagrasTotal;
    if (n <= 0) return [];

    if (n === 1) return [dY + B_MIN_PX];

    const innerH   = dH - B_MIN_PX - B_MIN_PX;
    const cn       = calcularCn();
    const allCs    = [...fabState.csEditables, cn];   // Cn al final
    const totalMm  = allCs.reduce((a, b) => a + b, 0);

    const pos = [dY + B_MIN_PX];
    for (let i = 0; i < allCs.length - 1; i++) {
        const cPx = totalMm > 0 ? (allCs[i] / totalMm) * innerH : innerH / allCs.length;
        pos.push(pos[pos.length - 1] + cPx);
    }
    pos.push(dY + dH - B_MIN_PX);
    return pos;
}

function getTiradorLado() {
    if (!fabState.tiradorPos || !fabState.mano) return null;
    if (fabState.tiradorPos === 'opuesto') {
        return fabState.mano === 'izquierda' ? 'derecha' : 'izquierda';
    }
    return fabState.tiradorPos;
}

function calcularZDefault() {
    if (!fabState.tiradorPos) return null;
    return fabState.tiradorPos === 'opuesto'
        ? Math.round(state.alturaReal / 2)
        : Math.round(state.anchoReal  / 2);
}

// ==========================================
// ENTRAR / SALIR DE LA VISTA
// ==========================================
function pasarAFabricacion() {
    // Mano por defecto: derecha (bisagras derecha, tirador izquierda)
    fabState.mano = 'derecha';
    fabState.b1 = CONFIG.bisagras_B1_defecto;
    fabState.b2 = CONFIG.bisagras_B2_defecto;
    fabState.csEditables = calcularCsDefault();

    // Tirador por defecto: opuesto a las bisagras, Z centrado
    if (state.tirador && state.tiradorTipo) {
        fabState.tiradorPos = 'opuesto';
        fabState.tiradorZ   = Math.round(state.alturaReal / 2);
    } else {
        fabState.tiradorPos = null;
        fabState.tiradorZ   = null;
    }

    // Ocultar formulario principal, mostrar vista fabricación
    document.getElementById('mainHeader').style.display    = 'none';
    document.getElementById('mainContainer').style.display = 'none';
    document.getElementById('fabVista').style.display      = 'flex';

    renderFabIzq();
    renderFabSVGs();
}

function volverConfigurador() {
    document.getElementById('mainHeader').style.display    = '';
    document.getElementById('mainContainer').style.display = '';
    document.getElementById('fabVista').style.display      = 'none';
}

// ==========================================
// COLUMNA IZQUIERDA
// ==========================================
function renderFabIzq() {
    renderFicha();
    renderInputs();
    bindFabInputs();
}

function renderFicha() {
    const m   = CONFIG.modelos[state.modelo];
    const a   = CONFIG.acabados[state.acabado];
    const t   = state.tirador && state.tiradorTipo ? CONFIG.tiradores[state.tiradorTipo] : null;
    const vStr = state.vidrioMontado
        ? (state.colorVidrio ? formatearColorVidrio(state.colorVidrio) : 'Sí')
        : 'No';

    document.getElementById('fabFicha').innerHTML = `
        <div class="fab-ficha-fila"><span>Modelo</span><strong>${state.modelo} — ${m?.nombre || ''}</strong></div>
        <div class="fab-ficha-fila"><span>Acabado</span><strong>${a?.nombre || '-'}</strong></div>
        <div class="fab-ficha-fila"><span>Alto × Ancho</span><strong>${state.alturaReal} × ${state.anchoReal} mm</strong></div>
        <div class="fab-ficha-fila"><span>Cantidad</span><strong>${state.cantidad} ud.</strong></div>
        <div class="fab-ficha-fila"><span>Bisagras</span><strong>${state.bisagrasTotal}</strong></div>
        ${t ? `<div class="fab-ficha-fila"><span>Tirador</span><strong>${t.medidas}</strong></div>` : ''}
        <div class="fab-ficha-fila"><span>Vidrio</span><strong>${vStr}</strong></div>
    `;
}

function renderInputs() {
    const n    = state.bisagrasTotal;
    const cn   = calcularCn();
    const tieneTirador = state.tirador && state.tiradorTipo;
    const bisagrasFijas = ['HAVA', 'HAVASP', 'KABI'].includes(state.modelo);

    // Cn automático (último C — absorbe redondeo)
    const cnOk = cn >= CONFIG.bisagras_C_minimo;
    const cnField = `
        <div class="fab-input-grupo">
            <label>C${n - 1} <span class="fab-hint">(auto)</span>
                <div class="fab-mm-row">
                    <input type="number" id="fabCn" value="${Math.round(cn)}"
                        class="${cnOk ? '' : 'fab-err'}" readonly>
                    <span>mm</span>
                </div>
            </label>
            <span class="fab-warn${cnOk ? '' : ' visible'}" id="fabCnWarn">
                ⚠ Mínimo ${CONFIG.bisagras_C_minimo} mm — ajusta B1, B2 o los otros C
            </span>
        </div>`;

    // C1..Cn-1 editables
    let cEditables = '';
    for (let i = 0; i < fabState.csEditables.length; i++) {
        cEditables += `
            <div class="fab-input-grupo">
                <label>C${i + 1}
                    <div class="fab-mm-row">
                        <input type="number" id="fabC${i + 1}" class="fab-c-edit"
                            data-cidx="${i}" value="${fabState.csEditables[i]}" min="${CONFIG.bisagras_C_minimo}" step="5">
                        <span>mm</span>
                    </div>
                </label>
            </div>`;
    }

    // Sección cotas bisagras — título siempre visible, contenido según modelo
    const secCotas = `
        <div class="fab-separador"></div>
        <div class="fab-grupo-label">Cotas de bisagras</div>
        ${bisagrasFijas
            ? `<p class="fab-hint" style="margin:6px 0 0;font-style:italic;">
                Este modelo tiene posición de bisagras fija</p>`
            : `<div class="fab-input-grupo">
                <label>B1 <span class="fab-hint">sup. (mín. 70)</span>
                    <div class="fab-mm-row">
                        <input type="number" id="fabB1" value="${fabState.b1}" min="${CONFIG.bisagras_B_minimo}" step="5">
                        <span>mm</span>
                    </div>
                </label>
            </div>

            ${cEditables}
            ${cnField}

            <div class="fab-input-grupo">
                <label>B2 <span class="fab-hint">inf. (mín. 70)</span>
                    <div class="fab-mm-row">
                        <input type="number" id="fabB2" value="${fabState.b2}" min="${CONFIG.bisagras_B_minimo}" step="5">
                        <span>mm</span>
                    </div>
                </label>
            </div>`
        }`;

    // Sección tirador
    let secTirador = '';
    if (tieneTirador) {
        const posBtns = [
            { id: 'opuesto', label: fabState.mano === 'izquierda' ? '→ Derecha' : '← Izquierda' },
            { id: 'arriba',  label: '↑ Arriba' },
            { id: 'abajo',   label: '↓ Abajo'  }
        ].map(op =>
            `<button class="fab-pos-btn${fabState.tiradorPos === op.id ? ' selected' : ''}"
                data-pos="${op.id}">${op.label}</button>`
        ).join('');

        const zVisible = fabState.tiradorPos !== null;
        const zLabel   = fabState.tiradorPos === 'opuesto'
            ? 'Z — desde abajo'
            : 'Z — desde izquierda';
        const zMax = fabState.tiradorPos === 'opuesto' ? state.alturaReal : state.anchoReal;

        secTirador = `
            <div class="fab-separador"></div>
            <div class="fab-grupo-label">Posición del tirador</div>
            <div class="fab-pos-btns">${posBtns}</div>
            <div class="fab-input-grupo" id="fabZGroup" style="display:${zVisible ? 'block' : 'none'}">
                <label>${zLabel}
                    <div class="fab-mm-row">
                        <input type="number" id="fabTiradorZ"
                            value="${fabState.tiradorZ ?? ''}" min="20" max="${zMax}" step="5">
                        <span>mm</span>
                    </div>
                </label>
            </div>`;
    }

    document.getElementById('fabInputs').innerHTML = `
        <div class="fab-grupo-label">Lado de las bisagras</div>
        <div class="fab-mano-btns">
            <button class="fab-mano-btn${fabState.mano === 'izquierda' ? ' selected' : ''}"
                data-mano="izquierda">Izquierda</button>
            <button class="fab-mano-btn${fabState.mano === 'derecha' ? ' selected' : ''}"
                data-mano="derecha">Derecha</button>
        </div>

        ${secCotas}
        ${secTirador}
    `;
}

// Devuelve el largo real del tirador activo en mm (primer número de la string de medidas)
function getTiradorLargoMm() {
    if (!state.tiradorTipo) return 63;
    const medidas = CONFIG.tiradores[state.tiradorTipo]?.medidas || '126 × 35 mm';
    return parseInt(medidas) || 63;
}

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function bindFabInputs() {
    document.querySelectorAll('.fab-mano-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            fabState.mano = btn.dataset.mano;
            renderInputs();
            bindFabInputs();
            renderFabSVGs();
        });
    });

    document.getElementById('fabB1')?.addEventListener('change', e => {
        const gaps   = state.bisagrasTotal - 1;
        const maxB1  = state.alturaReal - CONFIG.bisagras_B_minimo - gaps * CONFIG.bisagras_C_minimo;
        fabState.b1  = clamp(parseInt(e.target.value) || CONFIG.bisagras_B_minimo,
                             CONFIG.bisagras_B_minimo, maxB1);
        e.target.value = fabState.b1;
        actualizarCn();
        renderFabSVGs();
    });

    document.getElementById('fabB2')?.addEventListener('change', e => {
        const gaps   = state.bisagrasTotal - 1;
        const maxB2  = state.alturaReal - CONFIG.bisagras_B_minimo - gaps * CONFIG.bisagras_C_minimo;
        fabState.b2  = clamp(parseInt(e.target.value) || CONFIG.bisagras_B_minimo,
                             CONFIG.bisagras_B_minimo, maxB2);
        e.target.value = fabState.b2;
        actualizarCn();
        renderFabSVGs();
    });

    document.querySelectorAll('.fab-c-edit').forEach(input => {
        input.addEventListener('change', e => {
            const idx   = parseInt(e.target.dataset.cidx);
            const gaps  = state.bisagrasTotal - 1;
            // Máximo: deja al menos C_minimo para cada uno de los demás gaps
            const otrosCs = fabState.csEditables.reduce((s, v, i) => i === idx ? s : s + v, 0);
            const maxC  = state.alturaReal - fabState.b1 - fabState.b2
                          - otrosCs - CONFIG.bisagras_C_minimo; // al menos C_minimo para Cn
            fabState.csEditables[idx] = clamp(parseInt(e.target.value) || CONFIG.bisagras_C_minimo,
                                              CONFIG.bisagras_C_minimo, maxC);
            e.target.value = fabState.csEditables[idx];
            actualizarCn();
            renderFabSVGs();
        });
    });

    document.querySelectorAll('.fab-pos-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            fabState.tiradorPos = btn.dataset.pos;
            fabState.tiradorZ   = calcularZDefault();
            renderInputs();
            bindFabInputs();
            renderFabSVGs();
        });
    });

    document.getElementById('fabTiradorZ')?.addEventListener('change', e => {
        const largo  = getTiradorLargoMm();
        const mitad  = Math.ceil(largo / 2);
        const maxDim = fabState.tiradorPos === 'opuesto' ? state.alturaReal : state.anchoReal;
        fabState.tiradorZ = clamp(parseInt(e.target.value) || mitad, mitad, maxDim - mitad);
        e.target.value = fabState.tiradorZ;
        renderFabSVGs();
    });
}

function actualizarCn() {
    const c1   = calcularCn();
    const c1El = document.getElementById('fabCn');
    if (!c1El) return;
    c1El.value = Math.round(c1);
    const ok = c1 >= CONFIG.bisagras_C_minimo;
    c1El.classList.toggle('fab-err', !ok);
    const warnEl = document.getElementById('fabCnWarn');
    if (warnEl) warnEl.classList.toggle('visible', !ok);
}

// ==========================================
// SVG HELPERS
// ==========================================
const C_FRAME = '#2c3e50';
const C_DIM   = '#1a1a1a';
const C_TIR   = '#1a1a2e';

function svgDoorFrame(dX, dY, dW, dH, fr, svgId) {
    const glassFill = state.vidrioMontado ? `url(#glassGrad_${svgId})` : 'white';
    const glassDef  = state.vidrioMontado ? `
        <defs>
            <linearGradient id="glassGrad_${svgId}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stop-color="#d6eaf8" stop-opacity="0.9"/>
                <stop offset="45%"  stop-color="#ebf5fb" stop-opacity="0.6"/>
                <stop offset="70%"  stop-color="#aed6f1" stop-opacity="0.75"/>
                <stop offset="100%" stop-color="#85c1e9" stop-opacity="0.55"/>
            </linearGradient>
        </defs>` : '';
    return `${glassDef}
        <rect x="${dX}" y="${dY}" width="${dW}" height="${dH}"
              fill="#b0bec5" stroke="${C_FRAME}" stroke-width="2"/>
        <line x1="${dX}"      y1="${dY}"      x2="${dX+fr}"     y2="${dY+fr}"
              stroke="${C_FRAME}" stroke-width="1.5"/>
        <line x1="${dX+dW}"   y1="${dY}"      x2="${dX+dW-fr}"  y2="${dY+fr}"
              stroke="${C_FRAME}" stroke-width="1.5"/>
        <line x1="${dX}"      y1="${dY+dH}"   x2="${dX+fr}"     y2="${dY+dH-fr}"
              stroke="${C_FRAME}" stroke-width="1.5"/>
        <line x1="${dX+dW}"   y1="${dY+dH}"   x2="${dX+dW-fr}"  y2="${dY+dH-fr}"
              stroke="${C_FRAME}" stroke-width="1.5"/>
        <rect x="${dX+fr}" y="${dY+fr}" width="${dW-2*fr}" height="${dH-2*fr}"
              fill="${glassFill}" stroke="#aaa" stroke-width="0.8"/>`;
}

// Bisagras tipo escuadra (HAVA / HAVASP)
// Polígono L cerrado, relleno blanco, borde negro
// off  = separación del borde exterior del perfil
// eL   = longitud de cada brazo (más largo que el grosor)
// eW   = grosor del brazo (prop. 20mm/45mm — no cambia)
function svgBisagrasEsquina(dX, dY, dW, dH, fr, bisLado) {
    const eW  = fr * (20 / 70);        // grosor brazo — fijo
    const eL  = fr * 1;             // longitud brazo — más largo
    const off = fr * 0.20;             // separación del borde exterior
    const eSW = Math.max(1.5, fr * 0.12);

    function lPoly(corner) {
        let pts;
        if (corner === 'tl') pts = [
            [dX+off+eL,  dY+off     ],
            [dX+off,     dY+off     ],   // vértice
            [dX+off,     dY+off+eL  ],
            [dX+off+eW,  dY+off+eL  ],
            [dX+off+eW,  dY+off+eW  ],   // ángulo interior
            [dX+off+eL,  dY+off+eW  ],
        ];
        else if (corner === 'tr') pts = [
            [dX+dW-off-eL,  dY+off     ],
            [dX+dW-off,     dY+off     ],   // vértice
            [dX+dW-off,     dY+off+eL  ],
            [dX+dW-off-eW,  dY+off+eL  ],
            [dX+dW-off-eW,  dY+off+eW  ],   // ángulo interior
            [dX+dW-off-eL,  dY+off+eW  ],
        ];
        else if (corner === 'bl') pts = [
            [dX+off+eL,  dY+dH-off     ],
            [dX+off,     dY+dH-off     ],   // vértice
            [dX+off,     dY+dH-off-eL  ],
            [dX+off+eW,  dY+dH-off-eL  ],
            [dX+off+eW,  dY+dH-off-eW  ],   // ángulo interior
            [dX+off+eL,  dY+dH-off-eW  ],
        ];
        else /* br */ pts = [
            [dX+dW-off-eL,  dY+dH-off     ],
            [dX+dW-off,     dY+dH-off     ],   // vértice
            [dX+dW-off,     dY+dH-off-eL  ],
            [dX+dW-off-eW,  dY+dH-off-eL  ],
            [dX+dW-off-eW,  dY+dH-off-eW  ],   // ángulo interior
            [dX+dW-off-eL,  dY+dH-off-eW  ],
        ];
        const pStr = pts.map(p => p.join(',')).join(' ');
        return `<polygon points="${pStr}"
            fill="white" stroke="#111" stroke-width="${eSW}" stroke-linejoin="miter"/>`;
    }

    if (bisLado === 'izquierda') {
        return lPoly('tl') + lPoly('bl');
    } else {
        return lPoly('tr') + lPoly('br');
    }
}

function svgText(x, y, txt, sz, color, bold) {
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial,sans-serif" font-size="${sz}" fill="${color}"
        font-weight="${bold ? 'bold' : 'normal'}">${txt}</text>`;
}

// showValue=false → muestra nombre pero no el valor numérico
function svgDimV(x, y1, y2, name, value, side, showValue = true) {
    const arw  = 7;    // flechas más grandes
    const gap  = 8;
    // Normalizar para que top < bot siempre (evita flechas invertidas)
    const top  = Math.min(y1, y2);
    const bot  = Math.max(y1, y2);
    const midY = (top + bot) / 2;
    const pxH  = bot - top;
    const tx   = side === 'left' ? x - gap : x + gap;
    const anch = side === 'left' ? 'end' : 'start';

    let s = `<line x1="${x}" y1="${top}" x2="${x}" y2="${bot}"
        stroke="${C_DIM}" stroke-width="1.2"/>`;
    // Flecha superior apunta hacia ARRIBA (hacia fuera de la cota)
    s += `<polygon points="${x},${top} ${x-arw/2},${top+arw*1.4} ${x+arw/2},${top+arw*1.4}"
        fill="${C_DIM}"/>`;
    // Flecha inferior apunta hacia ABAJO (hacia fuera de la cota)
    s += `<polygon points="${x},${bot} ${x-arw/2},${bot-arw*1.4} ${x+arw/2},${bot-arw*1.4}"
        fill="${C_DIM}"/>`;

    if (pxH >= 14) {
        if (showValue) {
            if (name) {
                // Nombre arriba, valor abajo
                s += `<text x="${tx}" y="${midY - 6}" text-anchor="${anch}" dominant-baseline="middle"
                    font-family="Arial,sans-serif" font-size="11" fill="${C_DIM}"
                    font-weight="bold">${name}</text>`;
                s += `<text x="${tx}" y="${midY + 7}" text-anchor="${anch}" dominant-baseline="middle"
                    font-family="Arial,sans-serif" font-size="11" fill="${C_DIM}">${value}</text>`;
            } else {
                // Solo valor, centrado
                s += `<text x="${tx}" y="${midY}" text-anchor="${anch}" dominant-baseline="middle"
                    font-family="Arial,sans-serif" font-size="11" fill="${C_DIM}"
                    font-weight="bold">${value}</text>`;
            }
        } else {
            // Solo nombre, sin valor numérico
            s += `<text x="${tx}" y="${midY}" text-anchor="${anch}" dominant-baseline="middle"
                font-family="Arial,sans-serif" font-size="11" fill="${C_DIM}"
                font-weight="bold">${name}</text>`;
        }
    }
    return s;
}

function svgDimH(x1, x2, y, name, value, above) {
    const arw  = 7;    // flechas más grandes
    const midX = (x1 + x2) / 2;
    const ty   = above ? y - 12 : y + 14;

    let s = `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"
        stroke="${C_DIM}" stroke-width="1.2"/>`;
    // Flecha izquierda apunta hacia fuera (←)
    s += `<polygon points="${x1},${y} ${x1+arw*1.4},${y-arw/2} ${x1+arw*1.4},${y+arw/2}"
        fill="${C_DIM}"/>`;
    // Flecha derecha apunta hacia fuera (→)
    s += `<polygon points="${x2},${y} ${x2-arw*1.4},${y-arw/2} ${x2-arw*1.4},${y+arw/2}"
        fill="${C_DIM}"/>`;
    s += `<text x="${midX}" y="${ty}" text-anchor="middle"
        font-family="Arial,sans-serif" font-size="11" fill="${C_DIM}"
        font-weight="bold">${value}</text>`;
    return s;
}

// ==========================================
// SVG TRASERA
// ==========================================
function generarSVGTrasera() {
    const { alturaReal, anchoReal, bisagrasTotal } = state;
    const { mano, b1, b2 } = fabState;

    const VW = 400, VH = 560;
    const mL = 60, mR = 60, mTop = 65, mBot = 65;
    const availW = VW - mL - mR;
    const availH = VH - mTop - mBot;
    const scale  = Math.min(availW / anchoReal, availH / alturaReal);
    const dW = anchoReal * scale;
    const dH = alturaReal * scale;
    const dX = mL + (availW - dW) / 2;
    const dY = mTop + (availH - dH) / 2;

    const fr = 20;   // grosor visible del perfil en px
    const bisR = 8;  // radio círculo — cabe dentro de fr/2

    const cn    = calcularCn();
    const allCs = bisagrasTotal > 1 ? [...fabState.csEditables, cn] : [];

    let s = `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg"
        style="width:100%;height:auto;display:block;">`;
    s += `<rect width="${VW}" height="${VH}" fill="white"/>`;
    s += svgDoorFrame(dX, dY, dW, dH, fr, 'trasera');

    if (mano) {
        // Trasera: bisagras al lado CONTRARIO de mano
        const bisLado = mano === 'izquierda' ? 'derecha' : 'izquierda';
        const esEsquina = ['HAVA', 'HAVASP'].includes(state.modelo);

        if (esEsquina) {
            // Bisagra tipo escuadra en L — siempre arriba y abajo, sin cotas
            s += svgBisagrasEsquina(dX, dY, dW, dH, fr, bisLado);
        } else {
            // Bisagra tipo círculo con cotas B1/C/B2
            const bisX    = bisLado === 'izquierda' ? dX + fr / 2 : dX + dW - fr / 2;
            const bisPx   = getBisagraPxPositions(dY, dH);
            const dimX    = bisLado === 'izquierda' ? dX - 28 : dX + dW + 28;
            const dimSide = bisLado === 'izquierda' ? 'left'  : 'right';

            bisPx.forEach(py => {
                s += `<circle cx="${bisX}" cy="${py}" r="${bisR}"
                    fill="white" stroke="${C_FRAME}" stroke-width="1.6"/>`;
            });

            s += svgDimV(dimX, dY, bisPx[0], 'B1', 0, dimSide, false);
            for (let i = 0; i < bisPx.length - 1; i++) {
                s += svgDimV(dimX, bisPx[i], bisPx[i+1], `C${i+1}`, 0, dimSide, false);
            }
            s += svgDimV(dimX, bisPx[bisPx.length-1], dY + dH, 'B2', 0, dimSide, false);
        }
    }

    // Cotas Y y X — solo en este dibujo
    const yX    = mano === 'izquierda' ? dX - 30 : dX + dW + 30;
    const ySide = mano === 'izquierda' ? 'left'   : 'right';
    s += svgDimV(yX, dY, dY + dH, '', alturaReal, ySide, true);
    s += svgDimH(dX, dX + dW, dY + dH + 27, '', anchoReal, false);

    if (!mano) {
        s += svgText(VW/2, VH - 18, 'Selecciona el lado de las bisagras', 9, '#aaa', false);
    }

    s += '</svg>';
    return s;
}

// ==========================================
// SVG FRONTAL
// ==========================================
function generarSVGFrontal() {
    const { alturaReal, anchoReal } = state;

    const VW = 400, VH = 560;
    const mL = 60, mR = 60, mTop = 65, mBot = 65;
    const availW = VW - mL - mR;
    const availH = VH - mTop - mBot;
    const scale  = Math.min(availW / anchoReal, availH / alturaReal);
    const dW = anchoReal * scale;
    const dH = alturaReal * scale;
    const dX = mL + (availW - dW) / 2;
    const dY = mTop + (availH - dH) / 2;

    const fr = 20;
    const lado = getTiradorLado();
    const TL   = 126 * scale; // largo tirador escalado
    const TG   = 9;           // grosor visual fijo

    let tiradorSVG = '';
    let zDimSVG    = '';

    if (lado && fabState.tiradorZ) {
        let tx, ty, tw, th;

        if (lado === 'derecha') {
            const yc = dY + (alturaReal - fabState.tiradorZ) * scale;
            tx = dX + dW - TG / 2; ty = yc - TL / 2; tw = TG; th = TL;
            zDimSVG = svgDimV(dX + dW + TG/2 + 22, dY + dH, yc, '', fabState.tiradorZ, 'right', true);
        } else if (lado === 'izquierda') {
            const yc = dY + (alturaReal - fabState.tiradorZ) * scale;
            tx = dX - TG / 2; ty = yc - TL / 2; tw = TG; th = TL;
            zDimSVG = svgDimV(dX - TG/2 - 22, dY + dH, yc, '', fabState.tiradorZ, 'left', true);
        } else if (lado === 'arriba') {
            const xc = dX + fabState.tiradorZ * scale;
            tx = xc - TL / 2; ty = dY - TG / 2; tw = TL; th = TG;
            zDimSVG = svgDimH(dX, xc, dY - TG/2 - 22, 'Z', fabState.tiradorZ, true);
        } else if (lado === 'abajo') {
            const xc = dX + fabState.tiradorZ * scale;
            tx = xc - TL / 2; ty = dY + dH - TG / 2; tw = TL; th = TG;
            zDimSVG = svgDimH(dX, xc, dY + dH + TG/2 + 22, 'Z', fabState.tiradorZ, false);
        }

        tiradorSVG = `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}"
            fill="${C_TIR}" rx="2.5"/>`;
    }

    let s = `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg"
        style="width:100%;height:auto;display:block;">`;
    s += `<rect width="${VW}" height="${VH}" fill="white"/>`;
    s += svgDoorFrame(dX, dY, dW, dH, fr, 'frontal');
    s += tiradorSVG;
    s += zDimSVG;
    // Y y X solo en el dibujo trasera

    if (!lado) {
        const msg = state.tirador && state.tiradorTipo
            ? 'Selecciona mano y posición del tirador'
            : '(Sin tirador mecanizado)';
        s += svgText(VW/2, VH - 18, msg, 9, '#aaa', false);
    }

    s += '</svg>';
    return s;
}

// ==========================================
// RENDER AMBOS SVGs
// ==========================================
function renderFabSVGs() {
    document.getElementById('fabSvgTrasera').innerHTML = generarSVGTrasera();
    document.getElementById('fabSvgFrontal').innerHTML = generarSVGFrontal();
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
function inicializarFabricacion() {
    document.getElementById('fabBtnVolver')?.addEventListener('click', volverConfigurador);
    document.getElementById('fabBtnPDF')?.addEventListener('click', () => {
        alert('La generación de PDF estará disponible próximamente.');
    });
}

document.addEventListener('DOMContentLoaded', inicializarFabricacion);
