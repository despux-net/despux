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
    let renderRequested = false; // flag de animacion requestAnimationFrame

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

    // --- EVENTO: SUBIDA DE ARCHIVO Y DRAG&DROP ---
    const fileInput = document.getElementById('dxf-file');
    const loader = document.getElementById('loading-overlay');

    function procesarArchivo(file) {
        if (!file) return;

        // Mostrar loader visualmente obligando al navegador a repintar antes de bloquear el hilo
        loader.style.display = 'flex';
        
        setTimeout(() => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const fileContent = evt.target.result;
                try {
                    const Parser = window.DxfParser;
                    if (!Parser) throw new Error("La librería DXF no cargó correctamente del CDN.");
                    
                    const parser = new Parser();
                    dxfData = parser.parseSync(fileContent);
                    console.log("DXF Parsed:", dxfData);
                    procesarDXF(dxfData);
                } catch(err) {
                    console.error("Error del Parser DXF:", err);
                    alert("Aviso: Fallo al leer el archivo. Es probable que sea una versión muy nueva o contenga entidades complejas.\nPor favor ábralo en AutoCAD u otro CAD y guárdelo explícitamente como 'DXF AutoCAD 2013' (formato ASCII).");
                } finally {
                    loader.style.display = 'none';
                    if(fileInput) fileInput.value = ''; 
                }
            };
            reader.readAsText(file);
        }, 300); // Dar 300ms a la UI para que renderice el loader
    }

    fileInput.addEventListener('change', (e) => procesarArchivo(e.target.files[0]));

    // --- MANEJO DRAG AND DROP ---
    wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        wrapper.style.opacity = '0.7';
        wrapper.style.border = '4px dashed #3b82f6';
    });
    
    wrapper.addEventListener('dragleave', (e) => {
        e.preventDefault();
        wrapper.style.opacity = '1';
        wrapper.style.border = 'none';
    });
    
    wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.style.opacity = '1';
        wrapper.style.border = 'none';
        const file = e.dataTransfer.files[0];
        if (file && file.name.toLowerCase().endsWith('.dxf')) {
            procesarArchivo(file);
        } else {
            alert("Formato no válido. Por favor arrastre únicamente un archivo con extensión .dxf");
        }
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
        tempMeasurePt = null;

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
            
            // CIRCLE AUTODETECT
            let foundCircle = null;
            const hitTol = 15 / viewOpts.zoom; // 15 pixels de tolerancia en el mundo
            
            function searchForCircle(ents, ox=0, oy=0, scale=1) {
                ents.forEach(ent => {
                    if (layers[ent.layer] && !layers[ent.layer].visible) return;
                    if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
                        const cx = (ent.center.x * scale) + ox;
                        const cy = (ent.center.y * scale) + oy;
                        const r = ent.radius * scale;
                        const distToCenter = Math.hypot(wrld.x - cx, wrld.y - cy);
                        const distToEdge = Math.abs(distToCenter - r);
                        
                        if (distToCenter < hitTol || distToEdge < hitTol) {
                            foundCircle = { x: cx, y: cy, r: r };
                        }
                    } else if (ent.type === 'INSERT') {
                        const block = dxfData.blocks[ent.name];
                        if (block && block.entities) {
                            searchForCircle(block.entities, ox + ent.position.x, oy + ent.position.y, scale * (ent.scaleX || 1));
                        }
                    }
                });
            }
            if (measuringState === 0) searchForCircle(entities);

            if (foundCircle) {
                // Diámetro Automático detectado
                userMeasurements.push({
                    type: 'diameter',
                    cx: foundCircle.x,
                    cy: foundCircle.y,
                    r: foundCircle.r
                });
                requestRender();
                return;
            }

            // MEDICIÖN LINEAL DE 2 PUNTOS
            if(measuringState === 0 || measuringState === 2) {
                measuringState = 1;
                tempMeasurePt = wrld;
            } else if(measuringState === 1) {
                const dist = Math.sqrt(Math.pow(wrld.x - tempMeasurePt.x, 2) + Math.pow(wrld.y - tempMeasurePt.y, 2));
                userMeasurements.push({
                    type: 'line',
                    x1: tempMeasurePt.x, y1: tempMeasurePt.y,
                    x2: wrld.x, y2: wrld.y,
                    dist: dist
                });
                measuringState = 2;
                tempMeasurePt = null;
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
                document.getElementById('tool-hint').innerText = "Rueda ratón para Zoom. Arrastrar para Moverse.";
            } else {
                canvas.style.cursor = 'crosshair';
                measuringState = 0;
                tempMeasurePt = null;
                document.getElementById('tool-hint').innerText = "Click origen y destino para medir línea, o click en círculo para Diámetro.";
            }
            requestRender();
        });
    });

    document.getElementById('btn-clear-meas').addEventListener('click', () => {
        userMeasurements = [];
        measuringState = 0;
        tempMeasurePt = null;
        requestRender();
    });

    // --- RENDER ENGINE (HTML5 CANVAS) ---
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
        
        // PINTADO DE ENTIDADES DXF RECURSIVO CON TRANSFORMACIONES NATIVAS 
        ctx.save();
        ctx.translate(viewOpts.offsetX, viewOpts.offsetY);
        // Canvas invierte Y => usaremos -viewOpts.zoom p/ flip vertical
        ctx.scale(viewOpts.zoom, -viewOpts.zoom);
        // Grosor estricto invariable pese al zoom:
        ctx.lineWidth = 1.0 / Math.abs(viewOpts.zoom);
        ctx.lineJoin = 'round';

        function drawEntity(ent) {
            try {
                if (layers[ent.layer] && !layers[ent.layer].visible) return;

                ctx.beginPath();
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.8)';
                ctx.fillStyle = ctx.strokeStyle;

                if (ent.type === 'LINE') {
                    if(ent.vertices && ent.vertices.length >= 2) {
                        ctx.moveTo(ent.vertices[0].x, ent.vertices[0].y);
                        ctx.lineTo(ent.vertices[1].x, ent.vertices[1].y);
                        ctx.stroke();
                    }
                } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
                    if(ent.vertices && ent.vertices.length > 0) {
                        ctx.moveTo(ent.vertices[0].x, ent.vertices[0].y);
                        for (let i = 0; i < ent.vertices.length; i++) {
                            let v1 = ent.vertices[i];
                            let nextIdx = (i + 1 < ent.vertices.length) ? i + 1 : ((ent.shape || ent.closed) ? 0 : -1);
                            
                            if (nextIdx !== -1) {
                                let v2 = ent.vertices[nextIdx];
                                if (v1.bulge && Math.abs(v1.bulge) > 0.0001) {
                                    // Bulge arc math
                                    let bulge = v1.bulge;
                                    let dx = v2.x - v1.x;
                                    let dy = v2.y - v1.y;
                                    let dist = Math.hypot(dx, dy);
                                    if(dist > 0.0001) {
                                        let absBulge = Math.abs(bulge);
                                        let r = (dist / 2) * (absBulge*absBulge + 1) / (2 * absBulge);
                                        let angleP1P2 = Math.atan2(dy, dx);
                                        let sgn = Math.sign(bulge);
                                        let centerDist = (1 - absBulge*absBulge) / (2 * absBulge) * (dist / 2);
                                        
                                        let centerAngle = angleP1P2 - sgn * (Math.PI / 2);
                                        let cx = v1.x + dx/2 + centerDist * Math.cos(centerAngle);
                                        let cy = v1.y + dy/2 + centerDist * Math.sin(centerAngle);
                                        
                                        let startA = Math.atan2(v1.y - cy, v1.x - cx);
                                        let endA = Math.atan2(v2.y - cy, v2.x - cx);
                                        
                                        ctx.arc(cx, cy, r, startA, endA, bulge < 0); // ccw si bulge < 0 por flipped Y
                                    } else {
                                        ctx.lineTo(v2.x, v2.y);
                                    }
                                } else {
                                    if (i > 0 || nextIdx === 0) ctx.lineTo(v2.x, v2.y);
                                }
                            }
                        }
                        ctx.stroke();
                    }
                } else if (ent.type === 'CIRCLE') {
                    if(ent.center && ent.radius !== undefined) {
                        ctx.arc(ent.center.x, ent.center.y, ent.radius, 0, Math.PI*2);
                        ctx.stroke();
                    }
                } else if (ent.type === 'ARC') {
                    if(ent.center && ent.radius !== undefined) {
                        // Canvas scale(1, -1) significa false = CCW
                        let startA = (ent.startAngle || 0) * Math.PI/180;
                        let endA = (ent.endAngle || 0) * Math.PI/180;
                        ctx.arc(ent.center.x, ent.center.y, ent.radius, startA, endA, false);
                        ctx.stroke();
                    }
                } else if (ent.type === 'ELLIPSE') {
                    if(ctx.ellipse && ent.center && ent.majorAxisEndPoint) {
                        let rx = Math.sqrt(ent.majorAxisEndPoint.x**2 + ent.majorAxisEndPoint.y**2);
                        let ry = rx * (ent.axisRatio || 1);
                        let rot = Math.atan2(ent.majorAxisEndPoint.y, ent.majorAxisEndPoint.x);
                        let startA = ent.startAngle !== undefined ? ent.startAngle : 0;
                        let endA = ent.endAngle !== undefined ? ent.endAngle : (Math.PI * 2);
                        ctx.ellipse(ent.center.x, ent.center.y, rx, ry, rot, startA, endA, false);
                        ctx.stroke();
                    }
                } else if (ent.type === 'SPLINE') {
                    // Muchos DXF guardan la curva exacta en FitPoints, si no, caemos a controlPoints
                    let pts = ent.fitPoints && ent.fitPoints.length > 0 ? ent.fitPoints : ent.controlPoints;
                    if(pts && pts.length > 0) {
                        ctx.moveTo(pts[0].x, pts[0].y);
                        // Dibujado alámbrico interpolado que cubre huecos perfectos 
                        for (let i = 1; i < pts.length; i++) {
                            ctx.lineTo(pts[i].x, pts[i].y);
                        }
                        ctx.stroke();
                    }
                } else if (ent.type === 'INSERT') {
                    const block = dxfData.blocks && dxfData.blocks[ent.name];
                    if (block && block.entities) {
                        ctx.save();
                        if(ent.position) ctx.translate(ent.position.x || 0, ent.position.y || 0);
                        ctx.scale(ent.scaleX !== undefined ? ent.scaleX : 1, ent.scaleY !== undefined ? ent.scaleY : 1);
                        ctx.rotate((ent.rotation || 0) * Math.PI/180);
                        block.entities.forEach(blockEnt => drawEntity(blockEnt));
                        ctx.restore();
                    }
                }
            } catch(e) {
                console.warn("Fallo visualizando entidad DXF:", ent, e);
            }
        }
        entities.forEach(ent => drawEntity(ent));
        ctx.restore();

        // ----------------------------------------------------
        // RE-HABILITAMOS SCREEN SPACE PARA TEXTOS Y MEDIDAS  
        // ----------------------------------------------------
        ctx.lineWidth = 2;
        userMeasurements.forEach(m => {
            if (m.type === 'diameter') {
                const pc = worldToScreen(m.cx, m.cy);
                const pr = m.r * viewOpts.zoom;
                
                // Dimensión de diámetro en pantalla
                ctx.beginPath(); ctx.strokeStyle = '#3b82f6'; // blue-500
                ctx.arc(pc.x, pc.y, pr, 0, Math.PI*2); ctx.stroke();
                
                const valstr = "Ø:" + (m.r * 2).toFixed(2);
                ctx.font = 'bold 14px monospace'; ctx.fillStyle = isDark ? '#93c5fd' : '#1e3a8a';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                
                const w = ctx.measureText(valstr).width;
                ctx.fillStyle = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
                ctx.fillRect(pc.x - w/2 - 4, pc.y - 12, w + 8, 24);
                ctx.fillStyle = isDark ? '#93c5fd' : '#1d4ed8';
                ctx.fillText(valstr, pc.x, pc.y);

            } else {
                const p1 = worldToScreen(m.x1, m.y1);
                const p2 = worldToScreen(m.x2, m.y2);
                
                ctx.beginPath();
                ctx.strokeStyle = '#ef4444'; // Red-500
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
                
                ctx.fillStyle = '#ef4444';
                ctx.beginPath(); ctx.arc(p1.x, p1.y, 4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(p2.x, p2.y, 4, 0, Math.PI*2); ctx.fill();
                
                const mx = (p1.x + p2.x) / 2;
                const my = (p1.y + p2.y) / 2;
                ctx.font = 'bold 13px monospace';
                const valstr = m.dist.toFixed(2);
                
                const w = ctx.measureText(valstr).width;
                ctx.fillStyle = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
                ctx.fillRect(mx - w/2 - 2, my - 16, w + 4, 18);
                
                ctx.fillStyle = isDark ? '#fca5a5' : '#7f1d1d';
                ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillText(valstr, mx, my - 2);
            }
        });

        // Trazado de línea de cotado vivo flotante
        if (viewOpts.tool === 'measure' && measuringState === 1 && tempMeasurePt) {
            const p1 = worldToScreen(tempMeasurePt.x, tempMeasurePt.y);
            const wP = screenToWorld(mousePosScr.x, mousePosScr.y);
            
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#3b82f6';
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mousePosScr.x, mousePosScr.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Etiqueta flotante en el mouse
            const dist = Math.sqrt(Math.pow(wP.x - tempMeasurePt.x, 2) + Math.pow(wP.y - tempMeasurePt.y, 2));
            const valstr = dist.toFixed(2);
            ctx.font = 'bold 14px monospace'; ctx.fillStyle = isDark ? '#93c5fd' : '#1d4ed8';
            ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
            const w = ctx.measureText(valstr).width;
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';
            ctx.fillRect(mousePosScr.x + 12, mousePosScr.y - 20, w + 8, 20);
            ctx.fillStyle = isDark ? '#93c5fd' : '#1d4ed8';
            ctx.fillText(valstr, mousePosScr.x + 16, mousePosScr.y - 4);
        }
    }

});
