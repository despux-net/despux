document.addEventListener('DOMContentLoaded', () => {

    // =====================================================
    //  DARK MODE
    // =====================================================
    const themeToggle = document.getElementById('theme-toggle');
    const htmlEl = document.documentElement;
    const applyTheme = () => {
        const dark = localStorage.theme === 'dark' ||
            (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        htmlEl.classList.toggle('dark', dark);
        htmlEl.classList.toggle('light', !dark);
    };
    applyTheme();
    themeToggle.addEventListener('click', () => {
        localStorage.theme = htmlEl.classList.contains('dark') ? 'light' : 'dark';
        applyTheme();
        applyMeasureColors();
        renderMeasures();
    });

    // =====================================================
    //  DOM REFS
    // =====================================================
    const wrapper       = document.getElementById('canvas-wrapper');
    const svgContainer  = document.getElementById('svg-container');
    const measureCanvas = document.getElementById('cad-canvas');
    const mCtx          = measureCanvas.getContext('2d');
    const loader        = document.getElementById('loading-overlay');
    const fileInput     = document.getElementById('dxf-file');
    const coordX        = document.getElementById('coord-x');
    const coordY        = document.getElementById('coord-y');
    const toolHint      = document.getElementById('tool-hint');

    // =====================================================
    //  ESTADO GLOBAL
    // =====================================================
    let svgViewBox  = { x: 0, y: 0, w: 1000, h: 1000 }; // valores del SVG parseado
    let pan         = { x: 0, y: 0 };
    let zoom        = 1;
    // Arrays de capas: { name, svgGroup, visible }
    let layerMap    = {};
    // Para medidas
    let parsedDxf   = null;   // parsing crudo (dxf-parser legacy) si disponible
    let userMeas    = [];     // [{type:'line'|'diameter', ...}]
    let measState   = 0;      // 0=idle, 1=esperando 2do click
    let mPt1        = null;   // {wx, wy} primer punto en coords SVG mundo
    let tool        = 'pan';
    let isDragging  = false;
    let dragStart   = { x: 0, y: 0, panX: 0, panY: 0 };
    let mouseScr    = { x: 0, y: 0 }; // mouse en pixels del wrapper

    // =====================================================
    //  CANVAS OVERLAY RESIZE
    // =====================================================
    function resizeCanvas() {
        measureCanvas.width  = wrapper.clientWidth;
        measureCanvas.height = wrapper.clientHeight;
        renderMeasures();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // =====================================================
    //  COORDENADAS: SVG-mundo <-> pantalla
    //  El SVG tiene su propio viewBox. El container SVG
    //  es escalado por CSS transform: translate + scale.
    //  Debemos hacer la inversa para hallar coords mundo.
    // =====================================================
    function screenToSVGWorld(sx, sy) {
        // sx, sy en px relativos al wrapper
        const rect = svgContainer.getBoundingClientRect();
        const wRect = wrapper.getBoundingClientRect();

        // posición relativa al wrapper
        const relX = sx - (rect.left - wRect.left);
        const relY = sy - (rect.top  - wRect.top);

        // escala del SVG en pantalla
        const svgEl = svgContainer.querySelector('svg');
        if (!svgEl) return { x: 0, y: 0 };

        const dispW = svgEl.clientWidth  * zoom || 1;
        const dispH = svgEl.clientHeight * zoom || 1;
        const vbW   = svgViewBox.w || 1;
        const vbH   = svgViewBox.h || 1;

        const wx = svgViewBox.x + (relX / (dispW)) * vbW;
        const wy = svgViewBox.y + (relY / (dispH)) * vbH;
        return { x: wx, y: wy };
    }

    function svgWorldToScreen(wx, wy) {
        const svgEl = svgContainer.querySelector('svg');
        const rect  = svgContainer.getBoundingClientRect();
        const wRect = wrapper.getBoundingClientRect();

        if (!svgEl) return { x: 0, y: 0 };
        const dispW = svgEl.clientWidth  * zoom || 1;
        const dispH = svgEl.clientHeight * zoom || 1;
        const vbW   = svgViewBox.w || 1;
        const vbH   = svgViewBox.h || 1;

        const sx = (rect.left - wRect.left) + ((wx - svgViewBox.x) / vbW) * dispW;
        const sy = (rect.top  - wRect.top)  + ((wy - svgViewBox.y) / vbH) * dispH;
        return { x: sx, y: sy };
    }

    // =====================================================
    //  APLICAR TRANSFORM AL CONTENEDOR SVG
    // =====================================================
    function applyTransform() {
        svgContainer.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
        svgContainer.style.transformOrigin = '0 0';
    }

    // =====================================================
    //  CARGA DE ARCHIVO
    // =====================================================
    function procesarArchivo(file) {
        if (!file) return;
        loader.style.display = 'flex';

        setTimeout(() => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const content = evt.target.result;
                try {
                    cargarConBjnortier(content);
                } catch (e) {
                    console.error('bjnortier falló:', e);
                    try {
                        cargarConLegacy(content);
                    } catch (e2) {
                        console.error('Legacy también falló:', e2);
                        alert('No se pudo procesar el archivo DXF.\nIntente guardarlo como "DXF AutoCAD 2013 (ASCII)".\n\nDetalle: ' + e.message);
                    }
                } finally {
                    loader.style.display = 'none';
                    if (fileInput) fileInput.value = '';
                }
            };
            reader.readAsText(file);
        }, 300);
    }

    // =====================================================
    //  MÉTODO 1: dxf@4.1.0 (bjnortier) → toSVG()
    // =====================================================
    function cargarConBjnortier(content) {
        const DxfHelper = window.dxf;
        if (!DxfHelper) throw new Error('window.dxf no disponible');

        const helper = new DxfHelper(content);
        const svgStr = helper.toSVG();

        if (!svgStr || svgStr.trim().length < 10) {
            throw new Error('toSVG() devolvió contenido vacío');
        }

        insertarSVG(svgStr, 'bjnortier');

        // Intentar tamibén parser crudo para detección de círculos
        try {
            const parsed = helper.parsed;
            parsedDxf = (parsed && parsed.entities) ? parsed : null;
        } catch(e) { parsedDxf = null; }
    }

    // =====================================================
    //  MÉTODO 2: Fallback legacy dxf-parser → genera SVG propio
    // =====================================================
    function cargarConLegacy(content) {
        const LegacyParser = window.DxfParser;
        if (!LegacyParser) throw new Error('Ninguna librería DXF disponible');

        const parser = new LegacyParser();
        const data   = parser.parseSync(content);
        parsedDxf    = data;

        const svgStr = legacyToSVG(data);
        insertarSVG(svgStr, 'legacy');
    }

    // =====================================================
    //  CONVERSOR LEGACY → SVG (fallback manual)
    // =====================================================
    function legacyToSVG(data) {
        const ents  = data.entities || [];
        const blocks = data.blocks || {};
        let paths   = [];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        function updateBB(x, y) {
            if (!isFinite(x) || !isFinite(y)) return;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }

        function entToPath(ent, ox=0, oy=0, sc=1) {
            const layer = ent.layer || '0';
            let d = '';

            if (ent.type === 'LINE' && ent.vertices && ent.vertices.length >= 2) {
                const x1 = ent.vertices[0].x*sc+ox, y1 = ent.vertices[0].y*sc+oy;
                const x2 = ent.vertices[1].x*sc+ox, y2 = ent.vertices[1].y*sc+oy;
                d = `M ${x1} ${y1} L ${x2} ${y2}`;
                updateBB(x1,y1); updateBB(x2,y2);
            } else if ((ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') && ent.vertices && ent.vertices.length > 0) {
                const vs = ent.vertices;
                d = `M ${vs[0].x*sc+ox} ${vs[0].y*sc+oy}`;
                updateBB(vs[0].x*sc+ox, vs[0].y*sc+oy);
                for (let i = 0; i < vs.length; i++) {
                    const v1 = vs[i];
                    const nextI = (i+1 < vs.length) ? i+1 : ((ent.shape||ent.closed) ? 0 : -1);
                    if (nextI === -1) continue;
                    const v2 = vs[nextI];
                    if (v1.bulge && Math.abs(v1.bulge) > 0.0001) {
                        // Bulge → SVG arc
                        const dx = v2.x - v1.x, dy = v2.y - v1.y;
                        const dist = Math.hypot(dx, dy);
                        if (dist > 1e-6) {
                            const b = v1.bulge;
                            const ab = Math.abs(b);
                            const r = dist * (ab*ab + 1) / (4 * ab);
                            const largeArc = ab > 1 ? 1 : 0;
                            // En SVG el eje Y apunta hacia abajo, DXF hacia arriba
                            // sweep=1 → CW en SVG → CCW en DXF (b>0)
                            const sweep = b > 0 ? 1 : 0;
                            const x2s = v2.x*sc+ox, y2s = v2.y*sc+oy;
                            d += ` A ${r*sc} ${r*sc} 0 ${largeArc} ${sweep} ${x2s} ${y2s}`;
                            updateBB(x2s, y2s);
                        }
                    } else {
                        d += ` L ${v2.x*sc+ox} ${v2.y*sc+oy}`;
                        updateBB(v2.x*sc+ox, v2.y*sc+oy);
                    }
                }
                if (ent.shape || ent.closed) d += ' Z';
            } else if (ent.type === 'CIRCLE' && ent.center) {
                const cx = ent.center.x*sc+ox, cy = ent.center.y*sc+oy, r = ent.radius*sc;
                d = `M ${cx-r} ${cy} A ${r} ${r} 0 1 0 ${cx+r} ${cy} A ${r} ${r} 0 1 0 ${cx-r} ${cy} Z`;
                updateBB(cx-r,cy); updateBB(cx+r,cy);
            } else if (ent.type === 'ARC' && ent.center) {
                // En DXF: ángulos en grados CCW desde eje X positivo, Y arriba
                // En SVG: eje Y apunta abajo
                const cx = ent.center.x*sc+ox, cy = ent.center.y*sc+oy, r = ent.radius*sc;
                let sa = (ent.startAngle||0)*Math.PI/180;
                let ea = (ent.endAngle||0)*Math.PI/180;
                // Flip Y para SVG
                const x1 = cx + r*Math.cos(sa), y1 = cy - r*Math.sin(sa);
                const x2 = cx + r*Math.cos(ea), y2 = cy - r*Math.sin(ea);
                let sweep = ea > sa ? 0 : 1;
                let dAngle = ea - sa;
                if (dAngle < 0) dAngle += 2*Math.PI;
                const large = dAngle > Math.PI ? 1 : 0;
                d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
                updateBB(cx-r,cy); updateBB(cx+r,cy);
            } else if (ent.type === 'ELLIPSE' && ent.center && ent.majorAxisEndPoint) {
                // Aproximar elipse con arc SVG
                const rx = Math.sqrt(ent.majorAxisEndPoint.x**2 + ent.majorAxisEndPoint.y**2)*sc;
                const ry = rx * (ent.axisRatio||1);
                const cx = ent.center.x*sc+ox, cy = ent.center.y*sc+oy;
                const rot = Math.atan2(ent.majorAxisEndPoint.y, ent.majorAxisEndPoint.x)*180/Math.PI;
                d = `M ${cx-rx} ${cy} A ${rx} ${ry} ${rot} 1 0 ${cx+rx} ${cy} A ${rx} ${ry} ${rot} 1 0 ${cx-rx} ${cy} Z`;
                updateBB(cx-rx,cy); updateBB(cx+rx,cy);
            } else if (ent.type === 'SPLINE') {
                const pts = ent.fitPoints && ent.fitPoints.length > 0 ? ent.fitPoints : ent.controlPoints;
                if (pts && pts.length > 0) {
                    d = `M ${pts[0].x*sc+ox} ${pts[0].y*sc+oy}`;
                    for (let i=1; i<pts.length; i++) d += ` L ${pts[i].x*sc+ox} ${pts[i].y*sc+oy}`;
                    pts.forEach(p => updateBB(p.x*sc+ox, p.y*sc+oy));
                }
            } else if (ent.type === 'INSERT') {
                const block = blocks[ent.name];
                if (block && block.entities) {
                    const bx = (ent.position ? ent.position.x : 0)*sc+ox;
                    const by = (ent.position ? ent.position.y : 0)*sc+oy;
                    block.entities.forEach(be => entToPath(be, bx, by, sc*(ent.scaleX||1)));
                }
                return; // INSERT no genera path propio
            }

            if (d) {
                paths.push({ d, layer });
            }
        }

        ents.forEach(e => entToPath(e));

        if (!isFinite(minX)) { minX=0; maxX=500; minY=0; maxY=500; }
        const pad = 10;
        const vbX = minX - pad, vbY = minY - pad;
        const vbW = (maxX - minX) + pad*2;
        const vbH = (maxY - minY) + pad*2;

        // Armar SVG (con flip de eje Y vía transform)
        let layerGroups = {};
        paths.forEach(({d, layer}) => {
            if (!layerGroups[layer]) layerGroups[layer] = [];
            layerGroups[layer].push(d);
        });

        let groupsStr = Object.entries(layerGroups).map(([layer, ds]) =>
            `<g id="layer-${CSS.escape(layer)}" data-layer="${layer}">\n` +
            ds.map(d => `  <path d="${d}" fill="none"/>`).join('\n') +
            `\n</g>`
        ).join('\n');

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet">${groupsStr}</svg>`;
    }

    // =====================================================
    //  INSERTAR SVG + CAPAS + ENCUADRAR
    // =====================================================
    function insertarSVG(svgStr, source) {
        svgContainer.innerHTML = svgStr;
        const svgEl = svgContainer.querySelector('svg');
        if (!svgEl) throw new Error('SVG vacío o inválido');

        // Leer viewBox del SVG
        const vb = svgEl.getAttribute('viewBox');
        if (vb) {
            const [x,y,w,h] = vb.split(/[\s,]+/).map(Number);
            svgViewBox = { x, y, w, h };
        }

        // Forzar estilo para que el SVG ocupe espacio propio
        svgEl.style.display = 'block';
        svgEl.style.width  = '100%';
        svgEl.style.height = '100%';
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');

        // Aplicar color adaptable según tema
        applyMeasureColors();

        // Detectar capas desde grupos del SVG
        layerMap = {};
        userMeas = [];
        measState = 0;
        mPt1 = null;

        // Grupos con data-layer o id que contenga "layer"
        const groups = svgEl.querySelectorAll('[data-layer], g[id]');
        if (groups.length > 0) {
            groups.forEach(g => {
                const ln = g.getAttribute('data-layer') || g.getAttribute('id') || 'Unknown';
                layerMap[ln] = { el: g, visible: true };
            });
        } else {
            // Si no hay grupos, crear un "Default" virtual
            layerMap['Default'] = { el: svgEl, visible: true };
        }

        console.log(`SVG cargado via ${source}. Capas:`, Object.keys(layerMap));

        construirPanelCapas();
        encuadrarTodo();
        renderMeasures();
    }

    function applyMeasureColors() {
        const svgEl = svgContainer.querySelector('svg');
        if (!svgEl) return;
        const isDark = htmlEl.classList.contains('dark');
        const stroke = isDark ? '#e5e7eb' : '#1a1a1a'; // gray-200 / gray-900
        // Aplicar a todo el SVG
        svgEl.style.color = stroke;
        // Todos los paths sin stroke propio
        svgEl.querySelectorAll('path, line, polyline, rect, circle, ellipse').forEach(el => {
            if (!el.style.stroke) el.setAttribute('stroke', stroke);
            if (!el.style.fill && el.getAttribute('fill') !== 'none') {
                // no forzar fill en paths que ya tienen
            } else {
                el.setAttribute('fill', 'none');
            }
        });
    }

    // =====================================================
    //  PANEL DE CAPAS
    // =====================================================
    function construirPanelCapas() {
        const container = document.getElementById('layers-container');
        const countEl   = document.getElementById('layers-count');
        container.innerHTML = '';
        const names = Object.keys(layerMap);
        countEl.textContent = names.length;

        names.forEach(ln => {
            const item = document.createElement('div');
            item.className = 'layer-item flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700/80 text-sm cursor-pointer';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = true;
            cb.addEventListener('change', () => {
                layerMap[ln].visible = cb.checked;
                layerMap[ln].el.style.display = cb.checked ? '' : 'none';
            });

            const nameEl = document.createElement('span');
            nameEl.textContent = ln;
            nameEl.className = 'text-xs truncate';
            nameEl.title = ln;

            item.appendChild(cb);
            item.appendChild(nameEl);
            item.addEventListener('click', e => {
                if (e.target !== cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }
            });
            container.appendChild(item);
        });
    }

    // =====================================================
    //  ENCUADRAR TODO
    // =====================================================
    function encuadrarTodo() {
        pan  = { x: 0, y: 0 };
        zoom = 1;

        const svgEl = svgContainer.querySelector('svg');
        if (!svgEl) return;

        const wW = wrapper.clientWidth;
        const wH = wrapper.clientHeight;
        const vbW = svgViewBox.w || 1;
        const vbH = svgViewBox.h || 1;
        const pad = 40;

        const scaleX = (wW - pad*2) / vbW;
        const scaleY = (wH - pad*2) / vbH;
        zoom = Math.min(scaleX, scaleY);

        const scaledW = vbW * zoom;
        const scaledH = vbH * zoom;
        pan.x = (wW - scaledW) / 2;
        pan.y = (wH - scaledH) / 2;

        applyTransform();
        renderMeasures();
    }

    // =====================================================
    //  MOUSE EVENTS
    // =====================================================
    wrapper.addEventListener('mousedown', e => {
        const mx = e.offsetX, my = e.offsetY;
        mouseScr = { x: mx, y: my };

        if (tool === 'pan') {
            isDragging = true;
            dragStart  = { x: mx, y: my, panX: pan.x, panY: pan.y };
            wrapper.style.cursor = 'grabbing';
        } else if (tool === 'measure') {
            handleMeasureClick(mx, my);
        }
    });

    wrapper.addEventListener('mousemove', e => {
        const mx = e.offsetX, my = e.offsetY;
        mouseScr = { x: mx, y: my };

        // Coordenadas mundo → convertir del sistema SVG
        const svgEl = svgContainer.querySelector('svg');
        if (svgEl) {
            const wCoord = screenToSVGWorld(mx, my);
            coordX.textContent = wCoord.x.toFixed(2);
            // DXF Y es invertido respecto a SVG (SVG Y↓, DXF Y↑)
            coordY.textContent = (svgViewBox.y + svgViewBox.h - (wCoord.y - svgViewBox.y)).toFixed(2);
        }

        if (isDragging && tool === 'pan') {
            pan.x = dragStart.panX + (mx - dragStart.x);
            pan.y = dragStart.panY + (my - dragStart.y);
            applyTransform();
        } else if (tool === 'measure' && measState === 1) {
            renderMeasures(); // repintar preview
        }
    });

    wrapper.addEventListener('mouseup', () => {
        isDragging = false;
        if (tool === 'pan') wrapper.style.cursor = 'grab';
    });

    wrapper.addEventListener('wheel', e => {
        e.preventDefault();
        const delta    = e.deltaY > 0 ? 0.85 : 1.15;
        const mx = e.offsetX, my = e.offsetY;

        // Zoom centrado en el cursor
        const zoomPrev = zoom;
        zoom = Math.max(0.001, Math.min(100, zoom * delta));
        const ratio = zoom / zoomPrev;

        pan.x = mx - ratio * (mx - pan.x);
        pan.y = my - ratio * (my - pan.y);

        applyTransform();
        renderMeasures();
    }, { passive: false });

    // =====================================================
    //  HERRAMIENTA DE MEDIDA
    // =====================================================
    function handleMeasureClick(mx, my) {
        // Detección de círculo en SVG
        const svgEl = svgContainer.querySelector('svg');
        if (!svgEl) return;

        // Intentar hit-test sobre elementos circle del SVG
        const elements = document.elementsFromPoint(
            wrapper.getBoundingClientRect().left + mx,
            wrapper.getBoundingClientRect().top  + my
        );

        let hitCircle = null;
        for (const el of elements) {
            if (el.tagName === 'circle' || el.tagName === 'CIRCLE') {
                const cx = parseFloat(el.getAttribute('cx')||0);
                const cy = parseFloat(el.getAttribute('cy')||0);
                const r  = parseFloat(el.getAttribute('r')||0);
                hitCircle = { cx, cy, r };
                break;
            }
        }

        // También buscar en rawDxf circles/arcs si está disponible
        if (!hitCircle && parsedDxf && parsedDxf.entities) {
            const wCoord = screenToSVGWorld(mx, my);
            const tol = 12 / zoom;
            parsedDxf.entities.forEach(ent => {
                if (hitCircle) return;
                if ((ent.type === 'CIRCLE' || ent.type === 'ARC') && ent.center && ent.radius) {
                    const cx = ent.center.x, cy = ent.center.y, r = ent.radius;
                    // En SVG el Y está invertido
                    const screenCy = svgViewBox.y + svgViewBox.h - cy;
                    const dC = Math.hypot(wCoord.x - cx, wCoord.y - screenCy);
                    if (Math.abs(dC - r) < tol || dC < tol) {
                        hitCircle = { cx, cy: screenCy, r };
                    }
                }
            });
        }

        if (hitCircle && measState === 0) {
            userMeas.push({ type: 'diameter', ...hitCircle });
            renderMeasures();
            return;
        }

        // Medida lineal
        const wCoord = screenToSVGWorld(mx, my);
        if (measState === 0 || measState === 2) {
            measState = 1;
            mPt1 = { wx: wCoord.x, wy: wCoord.y, sx: mx, sy: my };
        } else if (measState === 1) {
            const dx = wCoord.x - mPt1.wx;
            const dy = wCoord.y - mPt1.wy;
            const dist = Math.hypot(dx, dy);
            userMeas.push({ type: 'line', x1: mPt1.wx, y1: mPt1.wy, x2: wCoord.x, y2: wCoord.y,
                            sx1: mPt1.sx, sy1: mPt1.sy, sx2: mx, sy2: my, dist });
            measState = 2;
            mPt1 = null;
            renderMeasures();
        }
    }

    // =====================================================
    //  RENDER DE MEDIDAS EN CANVAS OVERLAY
    // =====================================================
    function renderMeasures() {
        mCtx.clearRect(0, 0, measureCanvas.width, measureCanvas.height);
        const isDark = htmlEl.classList.contains('dark');

        userMeas.forEach(m => {
            if (m.type === 'diameter') {
                // Convertir coords SVG-mundo a pantalla
                const p = svgWorldToScreen(m.cx, m.cy);
                const r = m.r * zoom;

                mCtx.beginPath();
                mCtx.strokeStyle = '#3b82f6';
                mCtx.lineWidth = 2;
                mCtx.arc(p.x, p.y, r, 0, Math.PI*2);
                mCtx.stroke();

                const label = `Ø ${(m.r * 2).toFixed(3)}`;
                mCtx.font = 'bold 13px monospace';
                const tw = mCtx.measureText(label).width;
                mCtx.fillStyle = isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)';
                mCtx.fillRect(p.x - tw/2 - 4, p.y - 10, tw+8, 20);
                mCtx.fillStyle = isDark ? '#93c5fd' : '#1d4ed8';
                mCtx.textAlign = 'center';
                mCtx.textBaseline = 'middle';
                mCtx.fillText(label, p.x, p.y);
            } else {
                const p1 = svgWorldToScreen(m.x1, m.y1);
                const p2 = svgWorldToScreen(m.x2, m.y2);

                mCtx.beginPath();
                mCtx.strokeStyle = '#ef4444';
                mCtx.lineWidth = 2;
                mCtx.moveTo(p1.x, p1.y);
                mCtx.lineTo(p2.x, p2.y);
                mCtx.stroke();

                mCtx.fillStyle = '#ef4444';
                [[p1.x,p1.y],[p2.x,p2.y]].forEach(([px,py]) => {
                    mCtx.beginPath(); mCtx.arc(px,py,4,0,Math.PI*2); mCtx.fill();
                });

                const cx = (p1.x+p2.x)/2, cy = (p1.y+p2.y)/2;
                const label = m.dist.toFixed(3);
                mCtx.font = 'bold 13px monospace';
                const tw = mCtx.measureText(label).width;
                mCtx.fillStyle = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)';
                mCtx.fillRect(cx - tw/2 - 3, cy - 15, tw+6, 16);
                mCtx.fillStyle = isDark ? '#fca5a5' : '#7f1d1d';
                mCtx.textAlign = 'center';
                mCtx.textBaseline = 'bottom';
                mCtx.fillText(label, cx, cy - 2);
            }
        });

        // Preview flotante
        if (tool === 'measure' && measState === 1 && mPt1) {
            const p1 = { x: mPt1.sx, y: mPt1.sy };
            const p2 = mouseScr;
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const distPx = Math.hypot(dx, dy);
            // convertir a distancia mundo (aproximado)
            const distWorld = distPx / zoom;

            mCtx.beginPath();
            mCtx.setLineDash([5,5]);
            mCtx.strokeStyle = '#3b82f6';
            mCtx.lineWidth = 1.5;
            mCtx.moveTo(p1.x, p1.y);
            mCtx.lineTo(p2.x, p2.y);
            mCtx.stroke();
            mCtx.setLineDash([]);

            const label = distWorld.toFixed(3);
            mCtx.font = 'bold 13px monospace';
            const tw = mCtx.measureText(label).width;
            mCtx.fillStyle = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
            mCtx.fillRect(p2.x+12, p2.y-20, tw+8, 20);
            mCtx.fillStyle = isDark ? '#93c5fd' : '#1d4ed8';
            mCtx.textAlign = 'left';
            mCtx.textBaseline = 'bottom';
            mCtx.fillText(label, p2.x+16, p2.y-4);
        }
    }

    // =====================================================
    //  DRAG & DROP
    // =====================================================
    wrapper.addEventListener('dragover', e => { e.preventDefault(); wrapper.style.outline = '4px dashed #3b82f6'; });
    wrapper.addEventListener('dragleave', e => { e.preventDefault(); wrapper.style.outline = 'none'; });
    wrapper.addEventListener('drop', e => {
        e.preventDefault();
        wrapper.style.outline = 'none';
        const file = e.dataTransfer.files[0];
        if (file && file.name.toLowerCase().endsWith('.dxf')) {
            procesarArchivo(file);
        } else {
            alert('Arrastre únicamente archivos .dxf');
        }
    });

    fileInput.addEventListener('change', e => procesarArchivo(e.target.files[0]));

    // =====================================================
    //  BOTONES
    // =====================================================
    document.getElementById('btn-reset-view').addEventListener('click', encuadrarTodo);

    document.getElementById('btn-clear-meas').addEventListener('click', () => {
        userMeas = []; measState = 0; mPt1 = null;
        renderMeasures();
    });

    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        if (!window.html2pdf) { alert('Librería PDF no cargada.'); return; }
        window.html2pdf().set({
            margin: 10, filename: 'plano-dxf.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        }).from(wrapper).save();
    });

    document.querySelectorAll('.toolbox-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('.toolbox-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            tool = e.currentTarget.getAttribute('data-tool');

            if (tool === 'pan') {
                wrapper.style.cursor = 'grab';
                toolHint.textContent = 'Rueda del ratón para Zoom. Click arrastrar para moverse.';
                measState = 0; mPt1 = null;
                renderMeasures();
            } else {
                wrapper.style.cursor = 'crosshair';
                toolHint.textContent = 'Click en círculo/arco para Diámetro, o 2 clicks para medir distancia.';
            }
        });
    });

    // Cursor inicial
    wrapper.style.cursor = 'grab';

    // Texto de bienvenida inicial
    const svgEl = svgContainer.querySelector('svg');
    if (!svgEl) {
        mCtx.fillStyle = '#6b7280';
        mCtx.font = 'italic 14px sans-serif';
        mCtx.textAlign = 'center';
        mCtx.fillText('Espacio vacío. Seleccione o arrastre un archivo .DXF.', measureCanvas.width/2, measureCanvas.height/2);
    }
});
