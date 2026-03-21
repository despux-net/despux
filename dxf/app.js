document.addEventListener('DOMContentLoaded', () => {
    
    // --- GESTIÓN MODO OSCURO (UI) ---
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
        htmlElement.classList.toggle('dark');
        htmlElement.classList.toggle('light');
        localStorage.theme = htmlElement.classList.contains('dark') ? 'dark' : 'light';
        requestRender(); // repintar canvas si cambian colores
    });

    // --- VARIABLES DE ESTADO CAD ---
    let dxfData = null;       // Objeto devuelto por DxfParser
    let entities = [];        // Lista plana filtrada para render
    let layers = {};          // { LayerName: { color: "#FFF", visible: true } }
    let boundingBox = { minX:0, maxX:0, minY:0, maxY:0 };
    
    let userMeasurements = []; // [{x1,y1,x2,y2, dist}]
    let measuringState = 0;    // 0: inactivo, 1: esperando click A, 2: esperando click B
    let tempMeasurePt = null;  // {x,y}

    // --- CONFIGURACIÓN DE VISTA CANVAS (PAN/ZOOM) ---
    const canvas = document.getElementById('cad-canvas');
    const ctx = canvas.getContext('2d');
    const wrapper = document.getElementById('canvas-wrapper');
    
    let viewOpts = {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        tool: 'pan' // 'pan' o 'measure'
    };

    // --- MANEJO DE REDIMENSIONAMIENTO ---
    function resizeCanvas() {
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        requestRender();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --- EVENTO: SUBIDA DE ARCHIVO ---
    const fileInput = document.getElementById('dxf-file');
    const loader = document.getElementById('loading-overlay');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        loader.style.display = 'flex';
        const reader = new FileReader();
        
        reader.onload = (evt) => {
            const fileContent = evt.target.result;
            try {
                // El wrapper de DXFParser está atachado a windows en web
                const parser = new window.DxfParser();
                dxfData = parser.parseSync(fileContent);
                console.log("DXF Data Result:", dxfData);
                procesarDXF(dxfData);
            } catch(err) {
                console.error(err);
                alert("Hubo un error interpretando el archivo DXF. Es posible que esté corrupto o no soporte algunas entidades complejas. Guárdalo como DXF ASCII (versión 2013 o anterior) e intenta de nuevo.");
            } finally {
                loader.style.display = 'none';
                e.target.value = ''; // limpiar input
            }
        };
        // FileReader leerá como String ASCII
        reader.readAsText(file);
    });

    // --- PROCESADO LOGICO ---
    function procesarDXF(data) {
        if(!data.entities || data.entities.length === 0) {
            alert("El archivo no contiene entidades vectoriales legibles.");
            return;
        }

        entities = data.entities;
        layers = {};
        userMeasurements = [];
        measuringState = 0;
        document.getElementById('measurement-overlay').classList.add('hidden');

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        // Extraer Layers y Calcular Bounding Box Aprox
        // Los DXF de DxfParser extraen los colores basados en la paleta de AutoCAD (ACI) a Hexadecimal.
        Object.keys(data.tables.layer.layers).forEach(lname => {
            layers[lname] = { 
                visible: true, 
                color: true // DxfParser ya vincula colores
            };
        });

        entities.forEach(ent => {
            // Asegurar que la layer exista
            if (!layers[ent.layer]) layers[ent.layer] = { visible: true };
            
            // Calculo rápido de límites
            if(ent.type === 'LINE' && ent.vertices) {
                ent.vertices.forEach(v => {
                    if (v.x < minX) minX = v.x;
                    if (v.x > maxX) maxX = v.x;
                    if (v.y < minY) minY = v.y;
                    if (v.y > maxY) maxY = v.y;
                });
            } else if(ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
                if(ent.vertices) {
                    ent.vertices.forEach(v => {
                        if (v.x < minX) minX = v.x;
                        if (v.x > maxX) maxX = v.x;
                        if (v.y < minY) minY = v.y;
                        if (v.y > maxY) maxY = v.y;
                    });
                }
            } else if (ent.type === 'CIRCLE') {
                if (ent.center && ent.radius) {
                    minX = Math.min(minX, ent.center.x - ent.radius);
                    maxX = Math.max(maxX, ent.center.x + ent.radius);
                    minY = Math.min(minY, ent.center.y - ent.radius);
                    maxY = Math.max(maxY, ent.center.y + ent.radius);
                }
            }
        });

        // Si falló el bbox, asegurar default
        if(minX === Infinity) { minX = -100; maxX = 100; minY = -100; maxY = 100; }
        
        boundingBox = { minX, maxX, minY, maxY };
        
        dibujarMenuCapas();
        resetCamera();
    }

    function dibujarMenuCapas() {
        const container = document.getElementById('layers-container');
        document.getElementById('layers-count').innerText = Object.keys(layers).length;
        container.innerHTML = '';

        Object.keys(layers).forEach(layerName => {
            const div = document.createElement('div');
            div.className = 'layer-item flex items-center justify-between bg-gray-100 dark:bg-slate-700/50 px-3 py-2 rounded text-sm border border-gray-200 dark:border-slate-600';
            
            const labelStr = layerName.length > 20 ? layerName.substring(0,18)+'...' : layerName;
            
            div.innerHTML = `
                <span class="font-mono text-gray-700 dark:text-gray-300 pointer-events-none truncate" title="${layerName}">${labelStr}</span>
                <input type="checkbox" class="w-4 h-4 rounded" checked data-layer="${layerName}">
            `;
            
            div.querySelector('input').addEventListener('change', (e) => {
                layers[layerName].visible = e.target.checked;
                requestRender();
            });
            
            container.appendChild(div);
        });
    }

    function resetCamera() {
        if(!dxfData) return;
        const boxW = boundingBox.maxX - boundingBox.minX;
        const boxH = boundingBox.maxY - boundingBox.minY;
        
        // Ajustamos la escala para que quepa todo el bounding box en el viewport actual (con padding)
        const scaleX = (canvas.width * 0.85) / Math.abs(boxW || 1);
        const scaleY = (canvas.height * 0.85) / Math.abs(boxH || 1);
        viewOpts.zoom = Math.min(scaleX, scaleY);
        
        // Centramos
        const cx = boundingBox.minX + (boxW/2);
        const cy = boundingBox.minY + (boxH/2);
        
        viewOpts.offsetX = (canvas.width/2) - (cx * viewOpts.zoom);
        // Recordar que en Y, AutoCAD crece hacia arriba, Canvas hacia abajo. Invertiremos Y visualmente en render
        viewOpts.offsetY = (canvas.height/2) + (cy * viewOpts.zoom); 

        requestRender();
    }

    document.getElementById('btn-reset-view').addEventListener('click', resetCamera);

    // --- INTERACCION MOUSE (PAN/ZOOM/MEASURE) ---
    function worldToScreen(x, y) {
        return {
            x: (x * viewOpts.zoom) + viewOpts.offsetX,
            y: (-y * viewOpts.zoom) + viewOpts.offsetY // AutoCAD Y is inverted from Canvas Y
        };
    }
    
    function screenToWorld(sx, sy) {
        return {
            x: (sx - viewOpts.offsetX) / viewOpts.zoom,
            y: -(sy - viewOpts.offsetY) / viewOpts.zoom
        }
    }

    let mousePosScr = {x:0, y:0};

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (viewOpts.tool === 'pan') {
            viewOpts.isDragging = true;
            viewOpts.dragStartX = mouseX - viewOpts.offsetX;
            viewOpts.dragStartY = mouseY - viewOpts.offsetY;
            canvas.style.cursor = 'grabbing';
        } 
        else if (viewOpts.tool === 'measure') {
            const wrld = screenToWorld(mouseX, mouseY);
            if(measuringState === 0 || measuringState === 2) {
                // Iniciar medición
                measuringState = 1;
                tempMeasurePt = wrld;
                document.getElementById('meas-inst').innerText = 'Haga click en P2 (Final).';
            } else if(measuringState === 1) {
                // Finalizar Medición
                const dist = Math.sqrt(Math.pow(wrld.x - tempMeasurePt.x, 2) + Math.pow(wrld.y - tempMeasurePt.y, 2));
                userMeasurements.push({
                    x1: tempMeasurePt.x, y1: tempMeasurePt.y,
                    x2: wrld.x, y2: wrld.y,
                    dist: dist
                });
                measuringState = 2;
                tempMeasurePt = null;
                document.getElementById('meas-inst').innerText = 'Medición guardada. Clic para otra.';
            }
            requestRender();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        mousePosScr = {x:mx, y:my};
        
        // Indicador coordenadas HUD
        const wP = screenToWorld(mx, my);
        document.getElementById('coord-x').innerText = wP.x.toFixed(2);
        document.getElementById('coord-y').innerText = wP.y.toFixed(2);

        if (viewOpts.isDragging && viewOpts.tool === 'pan') {
            viewOpts.offsetX = mx - viewOpts.dragStartX;
            viewOpts.offsetY = my - viewOpts.dragStartY;
            requestRender();
        } else if (viewOpts.tool === 'measure' && measuringState === 1 && tempMeasurePt) {
            // Actualizar vista previa en vivo de la linea de medicion
            const dist = Math.sqrt(Math.pow(wP.x - tempMeasurePt.x, 2) + Math.pow(wP.y - tempMeasurePt.y, 2));
            document.getElementById('meas-result').innerText = dist.toFixed(2);
            requestRender();
        }
    });

    canvas.addEventListener('mouseup', () => {
        viewOpts.isDragging = false;
        if(viewOpts.tool === 'pan') canvas.style.cursor = 'grab';
    });
    canvas.addEventListener('mouseleave', () => {
        viewOpts.isDragging = false;
        if(viewOpts.tool === 'pan') canvas.style.cursor = 'grab';
    });

    // Zoom (Scroll Mueda) centrada en el mouse
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        // Convertimos a coordenadas mundo ANTES de cambiar zoom
        const wp = screenToWorld(mx, my);
        
        const zoomFactor = 1.1;
        if (e.deltaY < 0) {
            viewOpts.zoom *= zoomFactor; // acercar
        } else {
            viewOpts.zoom /= zoomFactor; // alejar
        }
        
        // Recalcular offset para que el punto (wP.x, wP.y) se mantenga bajo el ratón (mx, my)
        viewOpts.offsetX = mx - (wp.x * viewOpts.zoom);
        viewOpts.offsetY = my + (wp.y * viewOpts.zoom);

        requestRender();
    });

    // --- CAMBIO DE HERRAMIENTA ---
    document.querySelectorAll('.toolbox-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.toolbox-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            viewOpts.tool = e.currentTarget.getAttribute('data-tool');
            
            if(viewOpts.tool === 'pan') {
                canvas.style.cursor = 'grab';
                document.getElementById('measurement-overlay').classList.add('hidden');
                document.getElementById('tool-hint').innerText = "Rueda ratón para Zoom. Arrastrar para Moverse.";
            } else {
                canvas.style.cursor = 'crosshair';
                document.getElementById('measurement-overlay').classList.remove('hidden');
                measuringState = 0;
                document.getElementById('meas-inst').innerText = "Haga click en P1 (Inicio).";
                document.getElementById('meas-result').innerText = "0.00";
                document.getElementById('tool-hint').innerText = "Click origen y destino para medir línea.";
            }
        });
    });

    document.getElementById('btn-clear-meas').addEventListener('click', () => {
        userMeasurements = [];
        measuringState = 0;
        document.getElementById('meas-inst').innerText = "Haga click en P1 (Inicio).";
        document.getElementById('meas-result').innerText = "0.00";
        requestRender();
    });

    // --- RENDER ENGINE (HTML5 CANVAS) ---
    let renderRequested = false;
    function requestRender() {
        if(!renderRequested) {
            renderRequested = true;
            requestAnimationFrame(render);
        }
    }

    function render() {
        renderRequested = false;
        const isBwPdf = false; // Preparacion estructural en caso de PDF

        ctx.clearRect(0,0, canvas.width, canvas.height);

        if (!dxfData) {
            ctx.fillStyle = htmlElement.classList.contains('dark') ? '#9ca3af' : '#6b7280';
            ctx.font = 'italic 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("Espacio de Trabajo Vacío. Seleccione un .DXF de la barra lateral.", canvas.width/2, canvas.height/2);
            return;
        }

        const isDark = htmlElement.classList.contains('dark');
        
        entities.forEach(ent => {
            // Checkeo de visibilidad de layer
            if (layers[ent.layer] && !layers[ent.layer].visible) return;

            ctx.beginPath();
            
            // Asignacion de Color Inteligente (los DXFs asignan paletas ACI, vamos a mapear o limpiar si colisiona con el fondo)
            let drawColor = ent.color === 256 || !ent.color ? '#000000' : 'black'; 
            // Esto se refinará si el DXFParser retorna int o null colorIndex, para 256 suele ser byLayer
            // Simplificación radical CAD: Lineas principales contra el tema
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.8)';
            ctx.fillStyle = ctx.strokeStyle;
            ctx.lineWidth = 1;

            if (ent.type === 'LINE') {
                const start = worldToScreen(ent.vertices[0].x, ent.vertices[0].y);
                const end = worldToScreen(ent.vertices[1].x, ent.vertices[1].y);
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
            } 
            else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
                for (let i = 0; i < ent.vertices.length; i++) {
                    const vl = worldToScreen(ent.vertices[i].x, ent.vertices[i].y);
                    if (i === 0) ctx.moveTo(vl.x, vl.y);
                    else ctx.lineTo(vl.x, vl.y);
                }
                if (ent.shape || ent.closed) { // Si es pline cerrada
                   const vl0 = worldToScreen(ent.vertices[0].x, ent.vertices[0].y);
                   ctx.lineTo(vl0.x, vl0.y);
                }
                ctx.stroke();
            }
            else if (ent.type === 'CIRCLE') {
                const c = worldToScreen(ent.center.x, ent.center.y);
                const r = ent.radius * viewOpts.zoom;
                ctx.arc(c.x, c.y, r, 0, 2 * Math.PI);
                ctx.stroke();
            }
            else if (ent.type === 'ARC') {
                const c = worldToScreen(ent.center.x, ent.center.y);
                const r = ent.radius * viewOpts.zoom;
                // Arc ángulos en DXF están en grados, CounterClockWise
                const startA = -ent.startAngle * Math.PI / 180; 
                const endA = -ent.endAngle * Math.PI / 180;
                ctx.arc(c.x, c.y, r, startA, endA, true); // true por la inversion del eje Y
                ctx.stroke();
            }
        });

        // Capa interactiva de Cotas (Rojas/Azules vistosas)
        ctx.lineWidth = 2;
        userMeasurements.forEach(m => {
            const p1 = worldToScreen(m.x1, m.y1);
            const p2 = worldToScreen(m.x2, m.y2);
            
            ctx.beginPath();
            ctx.strokeStyle = '#ef4444'; // Red-500
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            
            // Puntos / Ticks
            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.arc(p1.x, p1.y, 4, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(p2.x, p2.y, 4, 0, Math.PI*2); ctx.fill();
            
            // Texto Dimen 
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            ctx.font = 'bold 13px monospace';
            ctx.fillStyle = isDark ? '#fca5a5' : '#7f1d1d';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(m.dist.toFixed(2), mx, my - 6);
        });

        // Dibujar prev pre-preview vivo si está trazando
        if (viewOpts.tool === 'measure' && measuringState === 1 && tempMeasurePt) {
            const p1 = worldToScreen(tempMeasurePt.x, tempMeasurePt.y);
            
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#3b82f6';
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mousePosScr.x, mousePosScr.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

});
