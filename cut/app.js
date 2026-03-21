document.addEventListener('DOMContentLoaded', () => {
    // Modo Dark / Light
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        htmlElement.classList.add('dark');
        htmlElement.classList.remove('light');
    } else {
        htmlElement.classList.remove('dark');
        htmlElement.classList.add('light');
    }

    themeToggle.addEventListener('click', () => {
        if (htmlElement.classList.contains('dark')) {
            htmlElement.classList.remove('dark');
            htmlElement.classList.add('light');
            localStorage.theme = 'light';
        } else {
            htmlElement.classList.add('dark');
            htmlElement.classList.remove('light');
            localStorage.theme = 'dark';
        }
    });

    // Lógica selector 1D vs 2D
    const radioModes = document.querySelectorAll('input[name="cut-mode"]');
    const colWidths = document.querySelectorAll('.col-width');
    
    function toggleModeInfo() {
        const mode = document.querySelector('input[name="cut-mode"]:checked').value;
        if(mode === '1D') {
            colWidths.forEach(el => el.classList.add('hidden-transition'));
        } else {
            colWidths.forEach(el => el.classList.remove('hidden-transition'));
        }
    }

    radioModes.forEach(r => r.addEventListener('change', toggleModeInfo));
    toggleModeInfo(); // Init

    // Añadir / Eliminar piezas
    const partsContainer = document.getElementById('parts-container');
    const btnAddPart = document.getElementById('btn-add-part');

    function attachRemoveEvent(btn) {
        btn.addEventListener('click', (e) => {
            if(partsContainer.children.length > 1) {
                e.target.closest('.part-row').remove();
            }
        });
    }

    document.querySelectorAll('.btn-remove').forEach(attachRemoveEvent);

    btnAddPart.addEventListener('click', () => {
        const firstRow = partsContainer.children[0];
        const newRow = firstRow.cloneNode(true);
        newRow.querySelector('.part-L').value = '';
        newRow.querySelector('.part-W').value = '0';
        newRow.querySelector('.part-Qty').value = '1';
        const numRows = partsContainer.children.length + 1;
        newRow.querySelector('.part-Lbl').value = 'P' + numRows;
        attachRemoveEvent(newRow.querySelector('.btn-remove'));
        partsContainer.appendChild(newRow);
    });

    document.getElementById('btn-optimize').addEventListener('click', optimizar);
    document.getElementById('btn-pdf').addEventListener('click', descargarPDF);
});

// ===============================================
// ALGORITMO: FIRST FIT DECREASING (BSP TREE)
// ===============================================
class Packer {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.root = { x: 0, y: 0, w: w, h: h, used: false };
    }
    
    fit(blocks, allowRot) {
        let node;
        for (let i = 0; i < blocks.length; i++) {
            let block = blocks[i];
            if (block.fit) continue;

            if ((node = this.findNode(this.root, block.w, block.h))) {
                block.fit = this.splitNode(node, block.w, block.h);
                block.rotated = false;
            } else if (allowRot && (node = this.findNode(this.root, block.h, block.w))) {
                block.fit = this.splitNode(node, block.h, block.w);
                block.rotated = true;
            }
        }
    }

    findNode(root, w, h) {
        if (root.used)
            return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
        else if ((w <= root.w) && (h <= root.h))
            return root;
        else
            return null;
    }

    splitNode(node, w, h) {
        node.used = true;
        node.down  = { x: node.x,     y: node.y + h, w: node.w,     h: node.h - h };
        node.right = { x: node.x + w, y: node.y,     w: node.w - w, h: h          };
        return { x: node.x, y: node.y }; 
    }

    getEmptyNodes(root = this.root, arr = []) {
        if (root.used) {
            if(root.right) this.getEmptyNodes(root.right, arr);
            if(root.down) this.getEmptyNodes(root.down, arr);
        } else {
            if (root.w > 0 && root.h > 0) {
                arr.push(root);
            }
        }
        return arr;
    }
}

// Generador de Color por Etiqueta (Pastel colors)
function getColorForLabel(label) {
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    // HSL: Matiz basado en Hash, Saturación alta, Brillo pastel
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 80%)`;
}

function optimizar() {
    const kerf = parseFloat(document.getElementById('kerf').value) || 0;
    
    // Obtener Modo Real (1D vs 2D)
    const mode = document.querySelector('input[name="cut-mode"]:checked').value;
    const is1D = (mode === '1D');
    const allowRotation = is1D ? false : document.getElementById('allow-rotation').checked;

    const stockRow = document.querySelector('.stock-row');
    const stockL = parseFloat(stockRow.querySelector('.input-L').value) || 0;
    let stockW = is1D ? 100 : (parseFloat(stockRow.querySelector('.input-W').value) || 0);

    if (stockL <= 0 || (!is1D && stockW <= 0)) {
        alert("Agregue dimensiones comerciales válidas (mayores a cero).");
        return;
    }

    const effStockL = stockL + kerf;
    const effStockW = is1D ? stockW : (stockW + kerf);

    let blocks = [];
    const partRows = document.querySelectorAll('.part-row');
    
    partRows.forEach(row => {
        const pL = parseFloat(row.querySelector('.part-L').value);
        let pW = is1D ? stockW : (parseFloat(row.querySelector('.part-W').value) || 0);
        const pQty = parseInt(row.querySelector('.part-Qty').value);
        const pLbl = row.querySelector('.part-Lbl').value || 'P';

        if (pL && pW && pQty) {
            for(let i=0; i<pQty; i++) {
                blocks.push({
                    realW: pL, 
                    realH: pW, 
                    w: pL + kerf,
                    h: is1D ? pW : (pW + kerf),
                    lbl: pLbl,
                    color: getColorForLabel(pLbl),
                    fit: null
                });
            }
        }
    });

    if (blocks.length === 0) {
        alert("Agregue piezas requeridas para generar un cálculo.");
        return;
    }

    blocks.sort((a, b) => {
        let maxA = Math.max(a.w, a.h);
        let maxB = Math.max(b.w, b.h);
        if (maxA !== maxB) return maxB - maxA;
        return (b.w * b.h) - (a.w * a.h);
    });

    let usedStocks = []; 
    let totalAreaCuted = 0; 
    let maxTries = 5000; 
    let leftoverNodes = [];

    let currentStockIndex = 0;
    
    while(blocks.some(b => !b.fit) && maxTries > 0) {
        let packer = new Packer(effStockL, effStockW);
        packer.fit(blocks, allowRotation);

        let fittedInThisStock = blocks.filter(b => b.fit && !b.stockId);
        
        if(fittedInThisStock.length > 0) {
            fittedInThisStock.forEach(b => {
                b.stockId = currentStockIndex + 1;
                totalAreaCuted += (b.realW * b.realH);
            });
            usedStocks.push({
                index: currentStockIndex + 1,
                parts: fittedInThisStock,
                packer: packer 
            });
            currentStockIndex++;
        } else {
            break;
        }
        maxTries--;
    }

    let missingBlocks = blocks.filter(b => !b.fit).length;

    // Calcular Sobrantes
    usedStocks.forEach(stock => {
        let empties = stock.packer.getEmptyNodes();
        empties.forEach(en => {
            let sW = en.w - kerf;
            let sH = is1D ? en.h : (en.h - kerf);
            
            if ((is1D && sW > 20) || (!is1D && sW > 50 && sH > 50)) {
                leftoverNodes.push({w: sW.toFixed(0), h: sH.toFixed(0), stock: stock.index});
            }
        });
    });

    // Reporte
    let unitsToBuy = usedStocks.length;
    let originalStockW = is1D ? 0 : parseFloat(document.querySelector('.input-W').value) || 0;
    
    let totalPurchasedArea = unitsToBuy * (stockL * (is1D ? 1 : originalStockW));
    let customAreaCut = is1D ? totalAreaCuted/100 : totalAreaCuted; // Normalizando la matemática en 1D
    let percWaste = unitsToBuy > 0 ? (((totalPurchasedArea - customAreaCut) / totalPurchasedArea) * 100) : 0;

    document.getElementById('stat-buy').innerText = unitsToBuy;
    document.getElementById('stat-buy-desc').innerText = is1D ? `Tubos/Perfiles de ${stockL}mm` : `Láminas de ${stockL}x${originalStockW}mm`;
    
    document.getElementById('stat-cut').innerText = (blocks.length - missingBlocks);
    document.getElementById('stat-waste').innerText = percWaste.toFixed(1) + '%';
    
    const loContainer = document.getElementById('leftovers-container');
    const loList = document.getElementById('leftovers-list');
    loList.innerHTML = '';
    if(leftoverNodes.length > 0) {
        loContainer.classList.remove('hidden');
        leftoverNodes.sort((a,b) => (b.w*b.h) - (a.w*a.h)).forEach(lo => {
            let dimText = is1D ? `${lo.w}mm` : `${lo.w} x ${lo.h}mm`;
            loList.innerHTML += `<span class="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-[11px] font-bold px-2 py-1 rounded border border-green-300 dark:border-green-700">Resto: ${dimText}</span>`;
        });
    } else {
        loContainer.classList.add('hidden');
    }

    document.getElementById('stats-container').classList.remove('hidden');
    document.getElementById('btn-pdf').classList.remove('hidden');

    // Render Canvas
    const renderContainer = document.getElementById('render-container');
    renderContainer.innerHTML = ''; 

    if(missingBlocks > 0) {
        const warn = document.createElement('div');
        warn.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded shadow-sm';
        warn.innerHTML = `<p class="font-bold">❌ Error Crítico: ${missingBlocks} pieza(s) no pueden procesarse.</p><p class="text-sm">Las medidas solicitadas son más grandes que el material comercial disponible. Imposible cortar.</p>`;
        renderContainer.appendChild(warn);
        if (unitsToBuy === 0) return;
    }

    usedStocks.forEach(stock => {
        const panelDiv = document.createElement('div');
        panelDiv.className = 'cut-plan-box';
        
        const header = document.createElement('h3');
        header.className = 'font-bold text-gray-700 dark:text-gray-300 mb-2 border-b border-gray-200 dark:border-slate-700 pb-1';
        header.innerText = `[${is1D ? 'Tubo' : 'Lámina'} Comercial #${stock.index}] (L: ${stockL} ${is1D ? '' : 'x W: ' + originalStockW})`;
        
        const canvas = document.createElement('canvas');
        canvas.className = 'w-full shadow-sm rounded overflow-hidden border border-gray-300 dark:border-slate-600 bg-gray-200 dark:bg-slate-700'; 
        
        panelDiv.appendChild(header);
        panelDiv.appendChild(canvas);
        renderContainer.appendChild(panelDiv);

        const ctx = canvas.getContext('2d');
        const scaleBy = 1000 / stockL; 
        canvas.width = stockL * scaleBy;
        canvas.height = is1D ? (100 * scaleBy) : (effStockW * scaleBy);
        
        // Pintar el fondo del tubo o lamina (Gris metálico o madera)
        ctx.fillStyle = is1D ? '#d1d5db' : '#e5e7eb'; // Tailwind gray-300 o 200
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Pintar Kerf implícito (Como líneas de corte / aserrín de fondo debajo de las fichas)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Tailwind bg-red-500 opacidad baja
        ctx.fillRect(0,0, canvas.width, canvas.height);

        stock.parts.forEach(part => {
            let cx = part.fit.x * scaleBy;
            let cy = part.fit.y * scaleBy;
            let cw = part.rotated ? part.realH * scaleBy : part.realW * scaleBy;
            let ch = part.rotated ? part.realW * scaleBy : part.realH * scaleBy;

            // Ficha (Corte en color)
            ctx.fillStyle = part.color; 
            ctx.fillRect(cx, cy, cw, ch);
            
            // Borde Ficha
            ctx.strokeStyle = '#334155'; // dark slate
            ctx.lineWidth = Math.max(1, 1.5 * scaleBy);
            ctx.strokeRect(cx, cy, cw, ch);

            // Texto Centro Ficha
            ctx.fillStyle = '#0f172a'; // Casi negro
            ctx.font = `bold ${Math.max(12, 18*scaleBy)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            let txt = `${part.lbl}`;
            let dimTxt = part.rotated ? `${part.realH}x${part.realW}` : `${part.realW}${is1D ? 'mm' : 'x' + part.realH}`;
            
            ctx.fillText(txt, cx + cw/2, cy + ch/2 - (is1D?0:6));
            if(ch > (30*scaleBy)) {
                ctx.font = `bold ${Math.max(10, 14*scaleBy)}px sans-serif`;
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillText(dimTxt, cx + cw/2, cy + ch/2 + (is1D?0:12));
            }
        });

        // Dibujar explícitamente el sobrante grande en verde si es 1D o muy obvio
        if(is1D) {
            let ultimoBordeX = 0;
            stock.parts.forEach(p => { ultimoBordeX = Math.max(ultimoBordeX, p.fit.x + p.w); });
            if(stockL - ultimoBordeX > 10) {
                let sx = ultimoBordeX * scaleBy;
                let sw = (stockL - ultimoBordeX) * scaleBy;
                ctx.fillStyle = 'rgba(74, 222, 128, 0.6)'; // Verde claro opaco
                ctx.fillRect(sx, 0, sw, canvas.height);
                
                // Rayado encima
                ctx.strokeStyle = 'rgba(21, 128, 61, 0.8)'; // Borde verde
                ctx.strokeRect(sx, 0, sw, canvas.height);

                ctx.fillStyle = '#064e3b';
                ctx.font = `bold ${Math.max(12, 16*scaleBy)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(`Restante: ${(stockL - ultimoBordeX).toFixed(1)}mm`, sx + sw/2, canvas.height/2);
            }
        }
    });
}

function descargarPDF() {
    const element = document.getElementById('export-area');
    const opt = {
      margin:       10,
      filename:     'Reporte-Corte-DESPUX.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}
