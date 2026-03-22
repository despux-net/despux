document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const inNominal = document.getElementById('nominal-size');
    const inHole = document.getElementById('hole-class');
    const inShaft = document.getElementById('shaft-class');
    const radioSys = document.querySelectorAll('input[name="systemType"]');
    const btnCalc = document.getElementById('btn-calculate');

    const outHoleClass = document.getElementById('out-hole-class');
    const outHoleMax = document.getElementById('out-hole-max');
    const outHoleMin = document.getElementById('out-hole-min');
    const outHoleTol = document.getElementById('out-hole-tol');

    const outShaftClass = document.getElementById('out-shaft-class');
    const outShaftMax = document.getElementById('out-shaft-max');
    const outShaftMin = document.getElementById('out-shaft-min');
    const outShaftTol = document.getElementById('out-shaft-tol');

    const outFitType = document.getElementById('out-fit-type');
    const outFitMax = document.getElementById('out-fit-max');
    const outFitMin = document.getElementById('out-fit-min');
    const outFitBadge = document.getElementById('out-fit-badge');

    const descText = document.getElementById('desc-text');
    const useText = document.getElementById('use-text');
    const forceText = document.getElementById('force-text');

    const svgView = document.getElementById('svg-view');

    // --- System Type Toggle Logic ---
    radioSys.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'hole') {
                inHole.value = `H${inHole.value.match(/\d+/)[0] || '7'}`;
            } else {
                inShaft.value = `h${inShaft.value.match(/\d+/)[0] || '6'}`;
            }
            calculateAndDraw();
        });
    });

    function getFitInterpretation(hole, shaft, fitType) {
        const hLet = hole.match(/[A-Za-z]+/)[0].toUpperCase();
        const sLet = shaft.match(/[A-Za-z]+/)[0].toLowerCase();
        
        let desc = "Ajuste especial.";
        let use = "No hay datos específicos para esta combinación atípica. Verifique los valores manuales.";
        let force = "Depende de la magnitud exacta.";

        if (fitType === 'clearance') {
            desc = "Ajuste móvil. El agujero siempre es más grande que el eje.";
            if (hLet === 'H' && ['f', 'g', 'h'].includes(sLet)) {
                desc = "Ajuste móvil de precisión.";
                use = "Ideal para mecanismos de precisión, palancas, varillas guía o cojinetes de giro lento.";
                force = "Se ensambla a mano lubricado. El movimiento es suave y sin 'traqueteo'.";
            } else if (hLet === 'H' && ['c', 'd', 'e'].includes(sLet)) {
                desc = "Ajuste móvil holgado.";
                use = "Se utiliza para ejes de rotación rápida, maquinaria agrícola o donde las variaciones de temperatura son grandes.";
                force = "Ensamblaje muy fácil a mano. Movimiento muy libre.";
            } else if (hLet === 'H' && ['a', 'b'].includes(sLet)) {
                desc = "Ajuste libre con mucho juego.";
                use = "Piezas que deben moverse muy libremente, a menudo con mucha holgura para temperatura o suciedad.";
                force = "Ensamblaje sin ningún esfuerzo.";
            }
        } 
        else if (fitType === 'interference') {
            desc = "Ajuste fijo (con interferencia). El eje siempre es más grande que el agujero.";
            if (hLet === 'H' && ['p', 'r', 's', 't', 'u'].includes(sLet)) {
                desc = "Ajuste prensado o forzado pesado.";
                use = "Ensamblajes permanentes que deben transmitir grandes torques sin chavetas (ej., coronas de bronce en núcleos de acero).";
                force = "Requiere prensa hidráulica pesada o dilatación térmica (calentar el agujero / enfriar el eje) para ensamblar.";
            } else if (hLet === 'H' && ['m', 'n'].includes(sLet)) {
                desc = "Ajuste forzado ligero.";
                use = "Ensamblajes permanentes moderados. Se usa a menudo donde una pieza no debe moverse por sí sola.";
                force = "Se ensambla utilizando una prensa ligera o golpes con mazo adecuado.";
            }
        } 
        else if (fitType === 'transition') {
            desc = "Ajuste de transición. Puede resultar en un ligero juego o una ligera interferencia dependiendo de las piezas reales.";
            if (hLet === 'H' && ['j', 'k'].includes(sLet)) {
                desc = "Ajuste de transición para posicionado.";
                use = "Piezas que deben ubicarse con precisión pero que deben poder desmontarse frecuentemente (ej., poleas con chaveta, engranajes).";
                force = "Se ensambla normalmente a mano o con la ayuda de un mazo de goma de forma ligera.";
            }
        }

        return { desc, use, force };
    }

    function drawSVG(res) {
        // Clear current
        svgView.innerHTML = '';
        if (!res) return;

        // Tolerances are in mm. We need to scale them beautifully for visualization
        // Find max boundaries relative to zero line
        // Zero line is 0 for nominal.
        const es = res.shaft.es; // microns
        const ei = res.shaft.ei;
        const ES = res.hole.ES;
        const EI = res.hole.EI;

        const maxDev = Math.max(Math.abs(ES), Math.abs(es), Math.abs(EI), Math.abs(ei));
        if (maxDev === 0) return;

        // SVG Canvas dimensions
        const W = svgView.clientWidth || 400;
        const H = svgView.clientHeight || 300;
        
        // PADDING
        const PADY = 40;
        const PADX = 50;

        // Scale factor: full height minus padding maps to 2 * maxDev
        const scale = (H / 2 - PADY) / (maxDev * 1.2); 
        
        // Y 0 is the center
        const Y0 = H / 2;
        
        // Function to convert microns to SVG Y coordinate (remember SVG Y goes down)
        const toY = (microns) => Y0 - (microns * scale);

        // Define Box Rectangles
        // Hole Box (Left)
        const holeW = (W - 3*PADX) / 2;
        const holeX = PADX;
        const holeTopY = toY(ES);
        const holeBotY = toY(EI);
        const holeH = holeBotY - holeTopY;

        // Shaft Box (Right)
        const shaftX = PADX * 2 + holeW;
        const shaftTopY = toY(es);
        const shaftBotY = toY(ei);
        const shaftH = shaftBotY - shaftTopY;

        // Create SVG string
        let svg = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">`;
        
        // Grid / Zero Line
        svg += `<line x1="20" y1="${Y0}" x2="${W-20}" y2="${Y0}" stroke="#a3a3a3" stroke-width="1" stroke-dasharray="8,4" />`;
        svg += `<text x="25" y="${Y0 - 5}" fill="#a3a3a3" font-size="12" font-family="monospace">0 (Nominal)</text>`;

        // Hole Zone (Green)
        svg += `<rect x="${holeX}" y="${holeTopY}" width="${holeW}" height="${Math.max(1, holeH)}" fill="#059669" fill-opacity="0.3" stroke="#10b981" stroke-width="2" rx="2" />`;
        // Hole Labels
        svg += `<text x="${holeX + holeW/2}" y="${holeTopY - 8}" fill="#10b981" font-size="12" font-weight="bold" text-anchor="middle">+${ES} µm</text>`;
        svg += `<text x="${holeX + holeW/2}" y="${holeBotY + 16}" fill="#10b981" font-size="12" font-weight="bold" text-anchor="middle">${EI > 0 ? '+' : ''}${EI} µm</text>`;
        svg += `<text x="${holeX + holeW/2}" y="${(holeTopY+holeBotY)/2 + 4}" fill="#ffffff" font-size="16" font-weight="bold" text-anchor="middle">${inHole.value.toUpperCase()}</text>`;

        // Shaft Zone (Red/Orange)
        svg += `<rect x="${shaftX}" y="${shaftTopY}" width="${holeW}" height="${Math.max(1, shaftH)}" fill="#dc2626" fill-opacity="0.3" stroke="#ef4444" stroke-width="2" rx="2" />`;
        // Shaft Labels
        svg += `<text x="${shaftX + holeW/2}" y="${shaftTopY - 8}" fill="#ef4444" font-size="12" font-weight="bold" text-anchor="middle">${es > 0 ? '+' : ''}${es} µm</text>`;
        svg += `<text x="${shaftX + holeW/2}" y="${shaftBotY + 16}" fill="#ef4444" font-size="12" font-weight="bold" text-anchor="middle">${ei > 0 ? '+' : ''}${ei} µm</text>`;
        svg += `<text x="${shaftX + holeW/2}" y="${(shaftTopY+shaftBotY)/2 + 4}" fill="#ffffff" font-size="16" font-weight="bold" text-anchor="middle">${inShaft.value.toLowerCase()}</text>`;

        // Interference / Clearance visually (Optional connecting zone)
        // If overlap, draw a striped red box in the overlap zone
        if (EI < es && ES > ei) {
            const overlapTopY = toY(Math.min(ES, es));
            const overlapBotY = toY(Math.max(EI, ei));
            // Just draw a subtle line indicating interference
            svg += `<rect x="${holeX+holeW+5}" y="${overlapTopY}" width="${shaftX - (holeX+holeW) - 10}" height="${overlapBotY - overlapTopY}" fill="url(#stripes)" opacity="0.5"/>`;
            svg += `<text x="${(holeX+holeW+shaftX)/2}" y="${(overlapTopY+overlapBotY)/2 + 4}" fill="#ef4444" font-size="10" text-anchor="middle">Interferencia</text>`;
        } else {
            // Clearance
            const clTopY = toY(Math.max(EI, ei));
            const clBotY = toY(Math.min(ES, es));
            svg += `<line x1="${holeX+holeW}" y1="${clTopY}" x2="${shaftX}" y2="${clTopY}" stroke="#2563eb" stroke-dasharray="2,2"/>`;
            svg += `<line x1="${holeX+holeW}" y1="${clBotY}" x2="${shaftX}" y2="${clBotY}" stroke="#2563eb" stroke-dasharray="2,2"/>`;
            svg += `<text x="${(holeX+holeW+shaftX)/2}" y="${(clTopY+clBotY)/2 + 4}" fill="#60a5fa" font-size="10" text-anchor="middle">Juego</text>`;
        }

        // Add stripe pattern def
        svg += `
            <defs>
                <pattern id="stripes" width="4" height="4" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="4" style="stroke:#dc2626; stroke-width:2" />
                </pattern>
            </defs>
        `;

        svg += `</svg>`;
        svgView.innerHTML = svg;
    }

    function calculateAndDraw() {
        const d = parseFloat(inNominal.value);
        const hc = inHole.value.trim();
        const sc = inShaft.value.trim();

        if (isNaN(d) || d <= 0 || !hc || !sc) return;

        const res = ISO286.calculateFit(d, hc, sc);
        
        if (!res) {
            alert('Valores ISO fuera de rango o mal formateados. Use ej: H7, g6, etc y d <= 500mm.');
            return;
        }

        // Update Labels
        outHoleClass.textContent = hc.toUpperCase();
        outShaftClass.textContent = sc.toLowerCase();

        outHoleMax.textContent = res.hole.max.toFixed(3);
        outHoleMin.textContent = res.hole.min.toFixed(3);
        outHoleTol.textContent = res.hole.total.toFixed(3);

        outShaftMax.textContent = res.shaft.max.toFixed(3);
        outShaftMin.textContent = res.shaft.min.toFixed(3);
        outShaftTol.textContent = res.shaft.total.toFixed(3);

        const isInterference = (res.fitType === 'interference');
        outFitType.textContent = isInterference ? 'Interferencia Máx / Mín' : 'Juego Máximo / Mínimo';
        
        outFitMax.textContent = res.maxFit.toFixed(3);
        outFitMin.textContent = res.minFit.toFixed(3);

        outFitBadge.className = `fit-badge ${res.fitType}`;
        outFitBadge.textContent = res.fitName;

        // Interpretations
        const interp = getFitInterpretation(hc, sc, res.fitType);
        descText.textContent = interp.desc;
        useText.textContent = interp.use;
        forceText.textContent = interp.force;

        // Draw SVG
        drawSVG(res);
    }

    // --- Init ---
    btnCalc.addEventListener('click', calculateAndDraw);
    
    // Auto-calculate on start
    calculateAndDraw();
});
