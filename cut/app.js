// Lógica de interfaz y manejo del DOM
document.addEventListener('DOMContentLoaded', () => {
    // Configuración de Tema (Dark/Light)
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    
    // Auto-detect based on OS pref if nothing saved
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

    // Añadir / Eliminar filas de piezas
    const partsContainer = document.getElementById('parts-container');
    const btnAddPart = document.getElementById('btn-add-part');

    function attachRemoveEvent(btn) {
        btn.addEventListener('click', (e) => {
            if(partsContainer.children.length > 1) {
                e.target.closest('.part-row').remove();
            }
        });
    }

    // Bind existing
    document.querySelectorAll('.btn-remove').forEach(attachRemoveEvent);

    btnAddPart.addEventListener('click', () => {
        const firstRow = partsContainer.children[0];
        const newRow = firstRow.cloneNode(true);
        // Clear specific inputs but keep qty 1
        newRow.querySelector('.part-L').value = '';
        newRow.querySelector('.part-W').value = '0';
        newRow.querySelector('.part-Qty').value = '1';
        
        // Auto-increment Label
        const numRows = partsContainer.children.length + 1;
        newRow.querySelector('.part-Lbl').value = 'P' + numRows;
        
        attachRemoveEvent(newRow.querySelector('.btn-remove'));
        partsContainer.appendChild(newRow);
    });

    // Lógica principal de Optimización
    const btnOptimize = document.getElementById('btn-optimize');
    btnOptimize.addEventListener('click', optimizar);

    const btnPdf = document.getElementById('btn-pdf');
    btnPdf.addEventListener('click', descargarPDF);
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
            // Si el bloque ya encajó en un stock previo, lo salteamos
            if (block.fit) continue;

            // Intentar orientación normal
            if ((node = this.findNode(this.root, block.w, block.h))) {
                block.fit = this.splitNode(node, block.w, block.h);
                block.rotated = false;
            } 
            // Intentar rotación
            else if (allowRot && (node = this.findNode(this.root, block.h, block.w))) {
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
        // Dividimos el espacio restante vertical y horizontalmente (Guillotina)
        node.down  = { x: node.x,     y: node.y + h, w: node.w,     h: node.h - h };
        node.right = { x: node.x + w, y: node.y,     w: node.w - w, h: h          };
        return { x: node.x, y: node.y }; // Retornamos dónde quedó el origen del bloque
    }
}

function optimizar() {
    // 1. Recoger configuración
    const kerf = parseFloat(document.getElementById('kerf').value) || 0;
    const allowRotation = document.getElementById('allow-rotation').checked;

    // 2. Recoger "Stocks"
    const stockRow = document.querySelector('.stock-row');
    const stockL = parseFloat(stockRow.querySelector('.input-L').value) || 0;
    let stockW = parseFloat(stockRow.querySelector('.input-W').value) || 0;
    const stockQty = parseInt(stockRow.querySelector('.input-Qty').value) || 1;

    let is1D = (stockW === 0 || isNaN(stockW));
    if (is1D) stockW = 100; // Fake Ancho para visualizarlo bien como listón/tubo.

    if (stockL <= 0) {
        alert("El material base debe tener Largo válido.");
        return;
    }

    // Para la matemática, sumamos el Kerf al inventario total disponible y a las piezas
    // Stock Efectivo = Stock Real + Kerf. 
    // Debido a que la última pieza en el borde no necesita kerf extra hacia afuera.
    const effStockL = stockL + kerf;
    const effStockW = is1D ? stockW : (stockW + kerf);

    // 3. Recoger Partes
    let blocks = [];
    const partRows = document.querySelectorAll('.part-row');
    
    // Parse parts into flat array
    partRows.forEach(row => {
        const pL = parseFloat(row.querySelector('.part-L').value);
        let pW = parseFloat(row.querySelector('.part-W').value) || 0;
        const pQty = parseInt(row.querySelector('.part-Qty').value);
        const pLbl = row.querySelector('.part-Lbl').value || 'P';

        if(is1D) pW = stockW; // En 1D el ancho es el total del listón/tubo

        if (pL && pW && pQty) {
            for(let i=0; i<pQty; i++) {
                // Dimensión efectiva = Dimensión Real + Kerf
                blocks.push({
                    realW: pL, // Mapeamos Largo a W
                    realH: pW, // Mapeamos Ancho a H
                    w: pL + kerf,
                    h: is1D ? pW : (pW + kerf),
                    lbl: pLbl,
                    fit: null
                });
            }
        }
    });

    if (blocks.length === 0) {
        alert("Agregue piezas con medidas válidas (Largo > 0).");
        return;
    }

    // 4. Ordenar bloques FFD (First Fit Decreasing)
    // El mejor heurístico suele ser ordenarlos por Área Descendente o Max(Dim)
    blocks.sort((a, b) => {
        let maxA = Math.max(a.w, a.h);
        let maxB = Math.max(b.w, b.h);
        if (maxA !== maxB) return maxB - maxA;
        return (b.w * b.h) - (a.w * a.h);
    });

    // 5. Ejecutar empacado (Bin Packing)
    let usedStocks = []; // Guarda los resultados por Panel/Color/Tubo
    let missingBlocks = 0;
    let totalAreaCuted = 0; // Área pura recortada sin kerf
    
    // Tratamos de empaquetar en cada "Stock" disponible
    let currentStockIndex = 0;
    while(currentStockIndex < stockQty) {
        let packer = new Packer(effStockL, effStockW);
        // El packer iterará todos los bloques e intentará encajarlos
        packer.fit(blocks, (!is1D && allowRotation));

        // Verificamos qué bloques entraron en este panel específico
        let fittedInThisStock = blocks.filter(b => b.fit && !b.stockId);
        
        if(fittedInThisStock.length > 0) {
            // Marcamos el bloque como que ya pertenece a este Stock ID
            fittedInThisStock.forEach(b => {
                b.stockId = currentStockIndex + 1;
                totalAreaCuted += (b.realW * b.realH);
            });
            usedStocks.push({
                index: currentStockIndex + 1,
                parts: fittedInThisStock
            });
            currentStockIndex++;
        } else {
            // Ningún bloque entró en un panel nuevo vacio, significa que las piezas sobrantes 
            // no caben ni siquiera solas (son más grandes que el panel).
            break;
        }
        
        // Si no quedan piezas sin asignar, salimos temprano
        if(blocks.filter(b => !b.fit).length === 0) break;
    }

    let unassigned = blocks.filter(b => !b.fit);
    missingBlocks = unassigned.length;

    // 6. Reporte de Estadísticas
    let totalStockArea = usedStocks.length * (stockL * stockW);
    let percWaste = 0;
    if (usedStocks.length > 0) {
        percWaste = ((totalStockArea - totalAreaCuted) / totalStockArea) * 100;
    }

    document.getElementById('stat-cut').innerText = (blocks.length - missingBlocks);
    document.getElementById('stat-used').innerText = `${usedStocks.length} / ${stockQty}`;
    document.getElementById('stat-waste').innerText = percWaste.toFixed(1) + '%';
    document.getElementById('stat-missing').innerText = missingBlocks;
    
    document.getElementById('stats-container').classList.remove('hidden');
    document.getElementById('btn-pdf').classList.remove('hidden');

    // 7. Renderizado Visual
    const renderContainer = document.getElementById('render-container');
    renderContainer.innerHTML = ''; // Limpiar previo

    if(usedStocks.length === 0) {
        renderContainer.innerHTML = '<p class="text-red-500 font-bold p-4">Las piezas superan las dimensiones máximas del material. Imposible cortar.</p>';
        return;
    }

    usedStocks.forEach(stock => {
        // Envoltorio para el panel
        const panelDiv = document.createElement('div');
        panelDiv.className = 'cut-plan-box';
        
        // Encabezado
        const header = document.createElement('h3');
        header.className = 'font-bold text-gray-700 dark:text-gray-300 mb-2';
        header.innerText = `Material ${stock.index} (L: ${stockL} x W: ${is1D ? '...' : stockW})`;
        
        // Canvas
        const canvas = document.createElement('canvas');
        canvas.className = 'w-full border border-gray-400 dark:border-gray-500 bg-[#fef0dd] shadow'; // Color madera/carton claro suave
        
        panelDiv.appendChild(header);
        panelDiv.appendChild(canvas);
        renderContainer.appendChild(panelDiv);

        const ctx = canvas.getContext('2d');
        // Para que se vea nítido en pantallas retina
        const scaleBy = 800 / stockL; // Normalizamos todos los lienzos a un ancho virtual de 800px min
        canvas.width = stockL * scaleBy;
        canvas.height = stockW * scaleBy;
        
        // Fondo base ya es el de canvas, trazamos los recortes
        stock.parts.forEach(part => {
            let cx = part.fit.x * scaleBy;
            let cy = part.fit.y * scaleBy;
            let cw = part.rotated ? part.realH * scaleBy : part.realW * scaleBy;
            let ch = part.rotated ? part.realW * scaleBy : part.realH * scaleBy;

            // Dibujar rectángulo
            ctx.fillStyle = '#fce7c8'; // Color interno
            ctx.fillRect(cx, cy, cw, ch);
            
            // Borde
            ctx.strokeStyle = '#c67840'; 
            ctx.lineWidth = Math.max(1, 2 * scaleBy);
            ctx.strokeRect(cx, cy, cw, ch);

            // Texto (Etiqueta + Medidas)
            ctx.fillStyle = '#4a2c16';
            ctx.font = `bold ${Math.max(12, 16*scaleBy)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Prevenir que el texto exceda los bordes
            let txt = `${part.lbl}`;
            let dimTxt = part.rotated ? `${part.realH}x${part.realW}` : `${part.realW}x${part.realH}`;
            
            ctx.fillText(txt, cx + cw/2, cy + ch/2 - (is1D?0:5));
            if(!is1D && ch > (30*scaleBy)) {
                ctx.font = `${Math.max(10, 12*scaleBy)}px sans-serif`;
                ctx.fillText(dimTxt, cx + cw/2, cy + ch/2 + 15);
            }
        });

        // Mostrar sombra residual por el Kerf
        // Matemáticamente el espacio está reservado en `part.fit.w` y `h` que incluyen kerf pero solo dibujamos `realW`
    });

    if(missingBlocks > 0) {
        const warn = document.createElement('div');
        warn.className = 'bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mt-4';
        warn.innerHTML = `<strong>Aviso:</strong> Hay ${missingBlocks} piezas que no pudieron encajarse. Necesita añadir más stock o revisar las medidas.`;
        renderContainer.appendChild(warn);
    }
}

// Exportación a PDF (Utilizando html2pdf)
function descargarPDF() {
    const element = document.getElementById('export-area');
    const opt = {
      margin:       10,
      filename:     'Optimizacion-Corte-DESPUX.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}
