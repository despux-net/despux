document.addEventListener('DOMContentLoaded', () => {
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

    // Retorna todos los nodos vacíos (sobrantes)
    getEmptyNodes(root = this.root, arr = []) {
        if (root.used) {
            if(root.right) this.getEmptyNodes(root.right, arr);
            if(root.down) this.getEmptyNodes(root.down, arr);
        } else {
            // Nodos que no están usados y tienen área útil
            if (root.w > 0 && root.h > 0) {
                arr.push(root);
            }
        }
        return arr;
    }
}

function optimizar() {
    const kerf = parseFloat(document.getElementById('kerf').value) || 0;
    const allowRotation = document.getElementById('allow-rotation').checked;

    const stockRow = document.querySelector('.stock-row');
    const stockL = parseFloat(stockRow.querySelector('.input-L').value) || 0;
    let stockW = parseFloat(stockRow.querySelector('.input-W').value) || 0;

    if (stockL <= 0) {
        alert("Agregue la dimensión comercial a comprar (Largo).");
        return;
    }

    let is1D = (stockW === 0 || isNaN(stockW));
    if (is1D) stockW = 100; // Fake Ancho en 1D

    const effStockL = stockL + kerf;
    const effStockW = is1D ? stockW : (stockW + kerf);

    let blocks = [];
    const partRows = document.querySelectorAll('.part-row');
    
    partRows.forEach(row => {
        const pL = parseFloat(row.querySelector('.part-L').value);
        let pW = parseFloat(row.querySelector('.part-W').value) || 0;
        const pQty = parseInt(row.querySelector('.part-Qty').value);
        const pLbl = row.querySelector('.part-Lbl').value || 'P';

        if(is1D) pW = stockW; 

        if (pL && pW && pQty) {
            for(let i=0; i<pQty; i++) {
                if (pL > stockL || (!is1D && pW > parseFloat(document.querySelector('.input-W').value))) {
                    console.warn(`Pieza ${pL}x${pW} excede la lámina ${stockL}x${parseFloat(document.querySelector('.input-W').value)}`);
                    // Se considerará imposible a simple criba si permitimos rotación o no
                }
                blocks.push({
                    realW: pL, 
                    realH: pW, 
                    w: pL + kerf,
                    h: is1D ? pW : (pW + kerf),
                    lbl: pLbl,
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
    let maxTries = 5000; // Failsafe para evitar loop infinito de piezas imposibles
    let leftoverNodes = [];

    // LÓGICA DE COMPRAS (Stock Infinito)
    // Instancia paneles hasta que todas las piezas encajables hayan encajado
    let currentStockIndex = 0;
    
    while(blocks.some(b => !b.fit) && maxTries > 0) {
        let packer = new Packer(effStockL, effStockW);
        packer.fit(blocks, (!is1D && allowRotation));

        let fittedInThisStock = blocks.filter(b => b.fit && !b.stockId);
        
        if(fittedInThisStock.length > 0) {
            fittedInThisStock.forEach(b => {
                b.stockId = currentStockIndex + 1;
                totalAreaCuted += (b.realW * b.realH);
            });
            usedStocks.push({
                index: currentStockIndex + 1,
                parts: fittedInThisStock,
                packer: packer // Guardamos el arbol para analizar los sobrantes
            });
            currentStockIndex++;
        } else {
            // Quedan piezas que literalmente no caben en un panel nuevo vacio (son más grandes que el propio panel)
            break;
        }
        maxTries--;
    }

    let missingBlocks = blocks.filter(b => !b.fit).length;

    // Calcular Sobrantes (Leftovers)
    usedStocks.forEach(stock => {
        let empties = stock.packer.getEmptyNodes();
        empties.forEach(en => {
            // Revertir el kerf para el cálculo de sobrante útil
            let sW = en.w - kerf;
            let sH = is1D ? en.h : (en.h - kerf);
            
            // Si el espacio es un borde tocando la pared, puede que no haya consumido kerf, pero heurísticamente aproximamos:
            // Solo considerar como un "sobrante reutilizable" si es mayor a 10cm (100mm) etc.
            if ((is1D && sW > 20) || (!is1D && sW > 50 && sH > 50)) {
                // Prevenir sobrantes fantasma diminutos
                leftoverNodes.push({w: sW.toFixed(0), h: sH.toFixed(0), stock: stock.index});
            }
        });
    });

    // 6. Reporte de Estadísticas
    let unitsToBuy = usedStocks.length;
    let originalStockW = parseFloat(document.querySelector('.input-W').value) || 0;
    
    // El Área o Longitud consumida pura vs lo que compras.
    // Solo para Mermas de aserrín puro: el porcentaje se calcula sobre piezas útiles (y todo el resto es aserrin + sobrantes usables)
    // Para no confundir, "Merma / Polvo" es un dato crudo o se puede calcular como todo lo que NO es la pieza.
    let totalPurchasedArea = unitsToBuy * (stockL * (is1D ? 1 : originalStockW));
    let customAreaCut = totalAreaCuted; 
    let percWaste = unitsToBuy > 0 ? (((totalPurchasedArea - customAreaCut) / totalPurchasedArea) * 100) : 0;

    document.getElementById('stat-buy').innerText = unitsToBuy;
    document.getElementById('stat-buy-desc').innerText = is1D ? `Tubos/Perfiles de ${stockL}` : `Láminas de ${stockL}x${originalStockW}`;
    
    document.getElementById('stat-cut').innerText = (blocks.length - missingBlocks);
    document.getElementById('stat-waste').innerText = percWaste.toFixed(1) + '%';
    
    // Inyectar Sobrantes
    const loContainer = document.getElementById('leftovers-container');
    const loList = document.getElementById('leftovers-list');
    loList.innerHTML = '';
    if(leftoverNodes.length > 0) {
        loContainer.classList.remove('hidden');
        leftoverNodes.sort((a,b) => (b.w*b.h) - (a.w*a.h)).forEach(lo => {
            let dimText = is1D ? `${lo.w}mm` : `${lo.w} x ${lo.h}mm`;
            loList.innerHTML += `<span class="bg-green-100 text-green-800 text-[11px] font-bold px-2 py-1 rounded border border-green-300">Retazo útil de ${dimText}</span>`;
        });
    } else {
        loContainer.classList.add('hidden');
    }

    document.getElementById('stats-container').classList.remove('hidden');
    document.getElementById('btn-pdf').classList.remove('hidden');

    // 7. Renderizado Visual
    const renderContainer = document.getElementById('render-container');
    renderContainer.innerHTML = ''; 

    if(missingBlocks > 0) {
        const warn = document.createElement('div');
        warn.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded shadow-sm';
        warn.innerHTML = `<p class="font-bold">❌ Error Crítico: ${missingBlocks} pieza(s) no pueden procesarse.</p><p class="text-sm">Las medidas solicitadas son más grandes que el material comercial disponible. Imposible cortar.</p>`;
        renderContainer.appendChild(warn);
        if (unitsToBuy === 0) return; // Si no hay nada mas que dibujar, abortar
    }

    usedStocks.forEach(stock => {
        const panelDiv = document.createElement('div');
        panelDiv.className = 'cut-plan-box';
        
        const header = document.createElement('h3');
        header.className = 'font-bold text-gray-700 dark:text-gray-300 mb-2 border-b border-gray-200 dark:border-gray-700 pb-1';
        header.innerText = `Unidad a Cortar #${stock.index} (L: ${stockL} ${is1D ? '' : 'x W: ' + originalStockW})`;
        
        const canvas = document.createElement('canvas');
        canvas.className = 'w-full border-2 border-gray-800 dark:border-gray-600 bg-[#fef0dd] dark:bg-slate-300 shadow'; 
        
        panelDiv.appendChild(header);
        panelDiv.appendChild(canvas);
        renderContainer.appendChild(panelDiv);

        const ctx = canvas.getContext('2d');
        const scaleBy = 800 / stockL; 
        canvas.width = stockL * scaleBy;
        canvas.height = effStockW * scaleBy;
        
        stock.parts.forEach(part => {
            let cx = part.fit.x * scaleBy;
            let cy = part.fit.y * scaleBy;
            let cw = part.rotated ? part.realH * scaleBy : part.realW * scaleBy;
            let ch = part.rotated ? part.realW * scaleBy : part.realH * scaleBy;

            // Pieza Interna (útil sin kerf)
            ctx.fillStyle = '#fce7c8'; 
            ctx.fillRect(cx, cy, cw, ch);
            
            // Borde / Disco
            ctx.strokeStyle = '#c67840'; 
            ctx.lineWidth = Math.max(1, 1.5 * scaleBy);
            ctx.strokeRect(cx, cy, cw, ch);

            ctx.fillStyle = '#4a2c16';
            ctx.font = `bold ${Math.max(12, 16*scaleBy)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            let txt = `${part.lbl}`;
            let dimTxt = part.rotated ? `${part.realH}x${part.realW}` : `${part.realW}x${part.realH}`;
            
            ctx.fillText(txt, cx + cw/2, cy + ch/2 - (is1D?0:5));
            if(!is1D && ch > (30*scaleBy)) {
                ctx.font = `${Math.max(10, 12*scaleBy)}px sans-serif`;
                ctx.fillText(dimTxt, cx + cw/2, cy + ch/2 + 15);
            }
        });

        // Dibujar el retazo principal si es 1D (para que se note qué quedó)
        if(is1D) {
            let ultimoBordeX = 0;
            stock.parts.forEach(p => { ultimoBordeX = Math.max(ultimoBordeX, p.fit.x + p.w); });
            if(stockL - ultimoBordeX > 10) {
                let sx = ultimoBordeX * scaleBy;
                let sw = (stockL - ultimoBordeX) * scaleBy;
                ctx.fillStyle = 'rgba(74, 222, 128, 0.3)'; // Verde claro
                ctx.fillRect(sx, 0, sw, canvas.height);
                ctx.fillStyle = '#166534';
                ctx.font = `${Math.max(10, 14*scaleBy)}px sans-serif`;
                ctx.fillText(`Sobrante: ${(stockL - ultimoBordeX).toFixed(1)}`, sx + sw/2, canvas.height/2);
            }
        }
    });
}

function descargarPDF() {
    const element = document.getElementById('export-area');
    const opt = {
      margin:       10,
      filename:     'Reporte-Compras-DESPUX.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}
