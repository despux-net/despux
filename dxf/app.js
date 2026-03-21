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
        requestRender();
    });

    // --- VARIABLES DE ESTADO CAD ---
    // polylinesByLayer: { "LayerName": [ [[x1,y1],[x2,y2],...], ... ] }
    let polylinesByLayer = {};
    // rawEntities: original parsed entities para búsqueda de círculos en la herramienta de medida
    let rawEntities = [];
    let layers = {};          // { LayerName: { visible: true } }
    let boundingBox = { minX:0, maxX:0, minY:0, maxY:0 };
    
    let userMeasurements = []; // [{type:'line'|'diameter', ...}]
    let measuringState = 0;    // 0: inactivo, 1: esperando click B
    let tempMeasurePt = null;  // {x, y}  en coords mundo
    let renderRequested = false;

    // --- CONFIGURACIÓN DE VISTA CANVAS ---
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
        tool: 'pan'
    };

    // Posición actual del mouse en pixels de pantalla (para línea flotante preview)
    let mousePosScr = { x: 0, y: 0 };

    // --- MANEJO DE REDIMENSIONAMIENTO ---
    function resizeCanvas() {
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        requestRender();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --- COORDENADAS ---
    function worldToScreen(wx, wy) {
        return {
            x: wx * viewOpts.zoom + viewOpts.offsetX,
            y: -wy * viewOpts.zoom + viewOpts.offsetY
        };
    }
    function screenToWorld(sx, sy) {
        return {
            x: (sx - viewOpts.offsetX) / viewOpts.zoom,
            y: -(sy - viewOpts.offsetY) / viewOpts.zoom
        };
    }

    // --- EVENTO: SUBIDA DE ARCHIVO Y DRAG&DROP ---
    const fileInput = document.getElementById('dxf-file');
    const loader = document.getElementById('loading-overlay');

    function procesarArchivo(file) {
        if (!file) return;
        loader.style.display = 'flex';
        
        setTimeout(() => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const fileContent = evt.target.result;
                try {
                    // *** NUEVA LIBRERÍA: dxf@4.1.0 (bjnortier) via unpkg ***
                    // expone window.dxf con Helper, toPolylines, toSVG, etc.
                    const DxfHelper = window.dxf;
                    if (!DxfHelper) throw new Error("La librería DXF avanzada no cargó correctamente.");
                    
                    const helper = new DxfHelper(fileContent);
                    
                    // toPolylines() resuelve INTERNAMENTE: 
                    //   INSERT/Bloques, Bulges en LWPOLYLINE, SPLINEs, ARCs, ELLIPSEs, etc.
                    // Devuelve: { entities: [ { type, layer, vertices:[[x,y],...] } ] }
                    const polylinesResult = helper.toPolylines();
                    
                    // También obtenemos el parse "crudo" para detectar círculos en la herramienta de medida
                    const parsed = helper.parsed;
                    rawEntities = (parsed && parsed.entities) ? parsed.entities : [];
                    
                    procesarPolylines(polylinesResult);

                } catch(err) {
                    console.error("Error del Parser DXF:", err);
                    
                    // Fallback: intentar con dxf-parser legacy si la librería nueva falla
                    try {
                        console.warn("Intentando fallback con dxf-parser legacy...");
                        const LegacyParser = window.DxfParser;
                        if (!LegacyParser) throw new Error("Tampoco está la librería legacy.");
                        const parser = new LegacyParser();
                        const legacyData = parser.parseSync(evt.target.result);
                        rawEntities = legacyData.entities || [];
                        procesarLegacyFallback(legacyData);
                    } catch(err2) {
                        alert("Error al procesar el archivo DXF.\nPor favor guárdelo desde AutoCAD como 'DXF AutoCAD 2013 (ASCII)'.\n\nDetalle: " + err.message);
                    }
                } finally {
                    loader.style.display = 'none';
                    if(fileInput) fileInput.value = '';
                }
            };
            reader.readAsText(file);
        }, 300);
    }

    fileInput.addEventListener('change', (e) => procesarArchivo(e.target.files[0]));

    wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        wrapper.style.outline = '4px dashed #3b82f6';
    });
    wrapper.addEventListener('dragleave', (e) => {
        e.preventDefault();
        wrapper.style.outline = 'none';
    });
    wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.style.outline = 'none';
        const file = e.dataTransfer.files[0];
        if (file && file.name.toLowerCase().endsWith('.dxf')) {
            procesarArchivo(file);
        } else {
            alert("Formato no válido. Por favor arrastre únicamente un archivo con extensión .dxf");
        }
    });

    // --- PROCESADO CON LIBRERÍA NUEVA (dxf@4.1.0 toPolylines) ---
    function procesarPolylines(polylinesResult) {
        if (!polylinesResult || !polylinesResult.entities || polylinesResult.entities.length === 0) {
            // Si no hay entidades, podría ser que el archivo esté vacío
            alert("El archivo no contiene entidades vectoriales legibles.");
            return;
        }

        polylinesByLayer = {};
        layers = {};
        userMeasurements = [];
        measuringState = 0;
        tempMeasurePt = null;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        polylinesResult.entities.forEach(ent => {
            const layerName = ent.layer || '0';
            if (!layers[layerName]) {
                layers[layerName] = { visible: true };
                polylinesByLayer[layerName] = [];
            }
            if (ent.vertices && ent.vertices.length > 0) {
                polylinesByLayer[layerName].push(ent.vertices);
                ent.vertices.forEach(([x, y]) => {
                    if (isFinite(x) && isFinite(y)) {
                        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    }
                });
            }
        });

        if(!isFinite(minX)) { minX=0; maxX=100; minY=0; maxY=100; }
        boundingBox = { minX, maxX, minY, maxY };

        construirPanelCapas();
        encuadrarTodo();
    }

    // --- FALLBACK CON LIBRERÍA LEGACY (dxf-parser) CUANDO LA NUEVA FALLA ---
    function procesarLegacyFallback(data) {
        const ents = data.entities || [];
        polylinesByLayer = {};
        layers = {};
        userMeasurements = [];
        measuringState = 0;
        tempMeasurePt = null;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        function addPoly(layerName, pts) {
            if (!layers[layerName]) {
                layers[layerName] = { visible: true };
                polylinesByLayer[layerName] = [];
            }
            if (pts.length > 0) {
                polylinesByLayer[layerName].push(pts);
                pts.forEach(([x, y]) => {
                    if (isFinite(x) && isFinite(y)) {
                        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    }
                });
            }
        }

        function processEntLegacy(ent, ox=0, oy=0, scale=1) {
            const ln = ent.layer || '0';
            if (ent.type === 'LINE' && ent.vertices && ent.vertices.length >= 2) {
                addPoly(ln, ent.vertices.map(v => [v.x * scale + ox, v.y * scale + oy]));
            } else if ((ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') && ent.vertices) {
                // Convierte vértices con posible bulge a segmentos
                let pts = [];
                for (let i = 0; i < ent.vertices.length; i++) {
                    let v1 = ent.vertices[i];
                    let nextIdx = (i + 1 < ent.vertices.length) ? i + 1 : ((ent.shape || ent.closed) ? 0 : -1);
                    pts.push([v1.x * scale + ox, v1.y * scale + oy]);
                    if (nextIdx !== -1 && v1.bulge && Math.abs(v1.bulge) > 0.0001) {
                        let v2 = ent.vertices[nextIdx];
                        let bulge = v1.bulge;
                        let dx = v2.x - v1.x;
                        let dy = v2.y - v1.y;
                        let dist = Math.hypot(dx, dy);
                        if (dist > 0.0001) {
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
                            let ccw = bulge > 0;
                            // Generar puntos de arco
                            let steps = Math.ceil(Math.abs(r) * 20);
                            steps = Math.max(8, Math.min(steps, 64));
                            let da = endA - startA;
                            if (ccw && da < 0) da += 2 * Math.PI;
                            if (!ccw && da > 0) da -= 2 * Math.PI;
                            for (let s = 1; s <= steps; s++) {
                                let a = startA + (da * s / steps);
                                pts.push([(cx + r * Math.cos(a)) * scale + ox, (cy + r * Math.sin(a)) * scale + oy]);
                            }
                        }
                    }
                }
                if (ent.shape || ent.closed) pts.push(pts[0]);
                addPoly(ln, pts);
            } else if (ent.type === 'CIRCLE' && ent.center) {
                let steps = 64;
                let r = ent.radius;
                let pts = [];
                for (let s = 0; s <= steps; s++) {
                    let a = s * 2 * Math.PI / steps;
                    pts.push([(ent.center.x + r * Math.cos(a)) * scale + ox, (ent.center.y + r * Math.sin(a)) * scale + oy]);
                }
                addPoly(ln, pts);
            } else if (ent.type === 'ARC' && ent.center) {
                let r = ent.radius;
                let startA = (ent.startAngle || 0) * Math.PI / 180;
                let endA = (ent.endAngle || 0) * Math.PI / 180;
                let da = endA - startA;
                if (da <= 0) da += 2 * Math.PI;
                let steps = Math.max(8, Math.ceil(da * r * 5));
                steps = Math.min(steps, 64);
                let pts = [];
                for (let s = 0; s <= steps; s++) {
                    let a = startA + da * s / steps;
                    pts.push([(ent.center.x + r * Math.cos(a)) * scale + ox, (ent.center.y + r * Math.sin(a)) * scale + oy]);
                }
                addPoly(ln, pts);
            } else if (ent.type === 'SPLINE') {
                let pts2 = ent.fitPoints && ent.fitPoints.length > 0 ? ent.fitPoints : ent.controlPoints;
                if (pts2 && pts2.length > 0) {
                    addPoly(ln, pts2.map(p => [p.x * scale + ox, p.y * scale + oy]));
                }
            } else if (ent.type === 'INSERT') {
                const block = data.blocks && data.blocks[ent.name];
                if (block && block.entities) {
                    let bx = ent.position ? ent.position.x : 0;
                    let by = ent.position ? ent.position.y : 0;
                    block.entities.forEach(be => processEntLegacy(be, ox + bx * scale, oy + by * scale, scale * (ent.scaleX || 1)));
                }
            }
        }

        ents.forEach(ent => processEntLegacy(ent));
        if (!isFinite(minX)) { minX=0; maxX=100; minY=0; maxY=100; }
        boundingBox = { minX, maxX, minY, maxY };
        construirPanelCapas();
        encuadrarTodo();
    }

    // --- PANEL DE CAPAS ---
    function construirPanelCapas() {
        const container = document.getElementById('layers-container');
        const countEl = document.getElementById('layers-count');
        container.innerHTML = '';
        const layerNames = Object.keys(layers);
        countEl.textContent = layerNames.length;

        layerNames.forEach(ln => {
            const item = document.createElement('div');
            item.className = 'layer-item flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700/80 text-sm cursor-pointer';
            const left = document.createElement('div');
            left.className = 'flex items-center gap-2 overflow-hidden';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = layers[ln].visible;
            cb.addEventListener('change', () => {
                layers[ln].visible = cb.checked;
                requestRender();
            });
            const nameEl = document.createElement('span');
            nameEl.textContent = ln;
            nameEl.className = 'truncate text-xs';
            nameEl.title = ln;
            left.appendChild(cb);
            left.appendChild(nameEl);
            item.appendChild(left);
            item.addEventListener('click', (e) => {
                if (e.target !== cb) {
                    cb.checked = !cb.checked;
                    layers[ln].visible = cb.checked;
                    requestRender();
                }
            });
            container.appendChild(item);
        });
    }

    // --- ENCUADRAR TODO ---
    function encuadrarTodo() {
        const { minX, maxX, minY, maxY } = boundingBox;
        const drawW = maxX - minX;
        const drawH = maxY - minY;
        const canW = canvas.width;
        const canH = canvas.height;
        const pad = 40;

        if (drawW === 0 || drawH === 0) {
            viewOpts.zoom = 1;
            viewOpts.offsetX = canW / 2;
            viewOpts.offsetY = canH / 2;
        } else {
            let scale = Math.min((canW - pad*2) / drawW, (canH - pad*2) / drawH);
            viewOpts.zoom = scale;
            // Centro del dibujo en coords de pantalla
            let cx = (minX + maxX) / 2;
            let cy = (minY + maxY) / 2;
            viewOpts.offsetX = canW / 2 - cx * scale;
            // Para Y invertido:
            viewOpts.offsetY = canH / 2 + cy * scale;
        }
        requestRender();
    }

    // --- BOTONES ---
    document.getElementById('btn-reset-view').addEventListener('click', encuadrarTodo);

    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        if (!window.html2pdf) { alert("Librería PDF no cargada."); return; }
        const opt = {
            margin: 10,
            filename: 'plano-dxf.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        const el = document.getElementById('canvas-wrapper');
        window.html2pdf().set(opt).from(el).save();
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
                document.getElementById('tool-hint').innerText = "Click en círculo para Diámetro, o 2 clicks para medir distancia.";
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

    // --- INTERACCIÓN CON EL CANVAS (Mouse) ---
    let mouseX = 0, mouseY = 0;

    canvas.addEventListener('mousedown', (e) => {
        const mx = e.offsetX;
        const my = e.offsetY;
        mouseX = mx; mouseY = my;

        if (viewOpts.tool === 'pan') {
            viewOpts.isDragging = true;
            viewOpts.dragStartX = mx - viewOpts.offsetX;
            viewOpts.dragStartY = my - viewOpts.offsetY;
            canvas.style.cursor = 'grabbing';
        } else if (viewOpts.tool === 'measure') {
            const wrld = screenToWorld(mx, my);

            // --- AUTODETECCIÓN DE CÍRCULOS ---
            let foundCircle = null;
            const hitTol = 15 / viewOpts.zoom;

            // Buscar en entidades crudas (dxf-parser legacy o el parsed de bjnortier)
            function searchCircles(ents, ox=0, oy=0, scale=1, data=null) {
                ents.forEach(ent => {
                    if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
                        const cx = (ent.center ? ent.center.x : 0) * scale + ox;
                        const cy = (ent.center ? ent.center.y : 0) * scale + oy;
                        const r = (ent.radius || 0) * scale;
                        const dCenter = Math.hypot(wrld.x - cx, wrld.y - cy);
                        const dEdge = Math.abs(dCenter - r);
                        if (dCenter < hitTol || dEdge < hitTol) {
                            if (!foundCircle || r < foundCircle.r) {
                                foundCircle = { cx, cy, r };
                            }
                        }
                    } else if (ent.type === 'INSERT' && data) {
                        const block = data.blocks && data.blocks[ent.name];
                        if (block && block.entities) {
                            let bx = ent.position ? ent.position.x : 0;
                            let by = ent.position ? ent.position.y : 0;
                            searchCircles(block.entities, ox + bx * scale, oy + by * scale, scale * (ent.scaleX || 1), data);
                        }
                    }
                });
            }
            if (rawEntities.length > 0) {
                // Necesitamos el objeto parsed completo para resolver bloques
                let parsedRef = null;
                try {
                    const DxfHelper = window.dxf;
                    if (DxfHelper && DxfHelper._lastParsed) parsedRef = DxfHelper._lastParsed;
                } catch(e) {}
                searchCircles(rawEntities, 0, 0, 1, parsedRef);
            }

            if (foundCircle) {
                userMeasurements.push({ type: 'diameter', cx: foundCircle.cx, cy: foundCircle.cy, r: foundCircle.r });
                requestRender();
                return;
            }

            // --- MEDICIÓN LINEAL ---
            if (measuringState === 0 || measuringState === 2) {
                measuringState = 1;
                tempMeasurePt = wrld;
            } else if (measuringState === 1) {
                const dist = Math.hypot(wrld.x - tempMeasurePt.x, wrld.y - tempMeasurePt.y);
                userMeasurements.push({ type: 'line', x1: tempMeasurePt.x, y1: tempMeasurePt.y, x2: wrld.x, y2: wrld.y, dist });
                measuringState = 2;
                tempMeasurePt = null;
            }
            requestRender();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const mx = e.offsetX;
        const my = e.offsetY;
        mouseX = mx; mouseY = my;
        mousePosScr = { x: mx, y: my };

        const wP = screenToWorld(mx, my);
        document.getElementById('coord-x').innerText = wP.x.toFixed(2);
        document.getElementById('coord-y').innerText = wP.y.toFixed(2);

        if (viewOpts.isDragging && viewOpts.tool === 'pan') {
            viewOpts.offsetX = mx - viewOpts.dragStartX;
            viewOpts.offsetY = my - viewOpts.dragStartY;
            requestRender();
        } else if (viewOpts.tool === 'measure' && measuringState === 1 && tempMeasurePt) {
            requestRender(); // repintar preview de línea flotante
        }
    });

    canvas.addEventListener('mouseup', () => {
        viewOpts.isDragging = false;
        if (viewOpts.tool === 'pan') canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.85 : 1.15;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const worldBefore = screenToWorld(mx, my);
        viewOpts.zoom *= delta;
        viewOpts.zoom = Math.max(0.001, Math.min(50000, viewOpts.zoom));
        const screenAfter = worldToScreen(worldBefore.x, worldBefore.y);
        viewOpts.offsetX += mx - screenAfter.x;
        viewOpts.offsetY += my - screenAfter.y;
        requestRender();
    }, { passive: false });

    // --- RENDER ENGINE ---
    function requestRender() {
        if (!renderRequested) {
            renderRequested = true;
            requestAnimationFrame(render);
        }
    }

    function render() {
        renderRequested = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isDark = htmlElement.classList.contains('dark');

        const hasContent = Object.keys(polylinesByLayer).length > 0;
        if (!hasContent) {
            ctx.fillStyle = isDark ? '#9ca3af' : '#6b7280';
            ctx.font = 'italic 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("Espacio de Trabajo Vacío. Seleccione un .DXF de la barra lateral.", canvas.width/2, canvas.height/2);
            return;
        }

        // ---- DIBUJO DE POLILÍNEAS ----
        // Las polylines en polylinesByLayer son [[x,y], [x,y], ...] en coords mundo DXF
        // Aplicamos worldToScreen directamente en lugar de transforms de canvas (más predecible)
        const strokeColor = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.85)';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        Object.keys(polylinesByLayer).forEach(ln => {
            if (!layers[ln] || !layers[ln].visible) return;
            const polylines = polylinesByLayer[ln];
            polylines.forEach(pts => {
                if (!pts || pts.length < 2) return;
                ctx.beginPath();
                let moved = false;
                for (let i = 0; i < pts.length; i++) {
                    const [wx, wy] = pts[i];
                    if (!isFinite(wx) || !isFinite(wy)) continue;
                    const s = worldToScreen(wx, wy);
                    if (!moved) { ctx.moveTo(s.x, s.y); moved = true; }
                    else ctx.lineTo(s.x, s.y);
                }
                ctx.stroke();
            });
        });

        // ---- MEDIDAS / COTAS ----
        ctx.lineWidth = 2;
        userMeasurements.forEach(m => {
            if (m.type === 'diameter') {
                const pc = worldToScreen(m.cx, m.cy);
                const pr = m.r * viewOpts.zoom;
                
                ctx.beginPath();
                ctx.strokeStyle = '#3b82f6';
                ctx.arc(pc.x, pc.y, pr, 0, Math.PI*2);
                ctx.stroke();

                const valstr = "Ø " + (m.r * 2).toFixed(3);
                ctx.font = 'bold 13px monospace';
                const tw = ctx.measureText(valstr).width;
                ctx.fillStyle = isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.75)';
                ctx.fillRect(pc.x - tw/2 - 4, pc.y - 10, tw + 8, 20);
                ctx.fillStyle = isDark ? '#93c5fd' : '#1d4ed8';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(valstr, pc.x, pc.y);

            } else {
                const p1 = worldToScreen(m.x1, m.y1);
                const p2 = worldToScreen(m.x2, m.y2);
                
                ctx.beginPath();
                ctx.strokeStyle = '#ef4444';
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();

                ctx.fillStyle = '#ef4444';
                ctx.beginPath(); ctx.arc(p1.x, p1.y, 4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(p2.x, p2.y, 4, 0, Math.PI*2); ctx.fill();

                const mx2 = (p1.x + p2.x) / 2;
                const my2 = (p1.y + p2.y) / 2;
                const valstr = m.dist.toFixed(3);
                ctx.font = 'bold 13px monospace';
                const tw = ctx.measureText(valstr).width;
                ctx.fillStyle = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)';
                ctx.fillRect(mx2 - tw/2 - 3, my2 - 15, tw + 6, 16);
                ctx.fillStyle = isDark ? '#fca5a5' : '#7f1d1d';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(valstr, mx2, my2 - 2);
            }
        });

        // ---- PREVIEW LÍNEA FLOTANTE DE MEDIDA ----
        if (viewOpts.tool === 'measure' && measuringState === 1 && tempMeasurePt) {
            const p1 = worldToScreen(tempMeasurePt.x, tempMeasurePt.y);
            const wP = screenToWorld(mousePosScr.x, mousePosScr.y);
            const dist = Math.hypot(wP.x - tempMeasurePt.x, wP.y - tempMeasurePt.y);

            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1.5;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mousePosScr.x, mousePosScr.y);
            ctx.stroke();
            ctx.setLineDash([]);

            const valstr = dist.toFixed(3);
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            const tw = ctx.measureText(valstr).width;
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)';
            ctx.fillRect(mousePosScr.x + 12, mousePosScr.y - 20, tw + 8, 20);
            ctx.fillStyle = isDark ? '#93c5fd' : '#1d4ed8';
            ctx.fillText(valstr, mousePosScr.x + 16, mousePosScr.y - 4);
        }
    }

    // Iniciar primer render vacío
    requestRender();
});
