document.addEventListener('DOMContentLoaded', () => {
    // --- DARK MODE ---
    const htmlEl = document.documentElement;
    const applyTheme = () => {
        const dark = localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        htmlEl.classList.toggle('dark', dark);
        htmlEl.classList.toggle('light', !dark);
    };
    applyTheme();
    document.getElementById('theme-toggle').addEventListener('click', () => {
        localStorage.theme = htmlEl.classList.contains('dark') ? 'light' : 'dark';
        applyTheme();
        requestRender();
    });

    // --- STATE ---
    let dxfData      = null;
    let allEntities  = [];   // flattened with block expansion
    let layers       = {};   // { name: { visible } }
    let bbox         = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    let userMeas     = [];
    let measState    = 0;
    let mPt1         = null;
    let renderReq    = false;
    let mouseScr     = { x: 0, y: 0 };
    let view = { zoom: 1, ox: 0, oy: 0, dragging: false, dsx: 0, dsy: 0, tool: 'pan' };

    // --- CANVAS ---
    const canvas  = document.getElementById('cad-canvas');
    const ctx     = canvas.getContext('2d');
    const wrapper = document.getElementById('canvas-wrapper');
    function resizeCanvas() { canvas.width = wrapper.clientWidth; canvas.height = wrapper.clientHeight; requestRender(); }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --- COORDINATE TRANSFORMS ---
    // DXF has Y-up; screen has Y-down. We manually flip.
    function w2s(wx, wy) { return { x: wx * view.zoom + view.ox, y: -wy * view.zoom + view.oy }; }
    function s2w(sx, sy) { return { x: (sx - view.ox) / view.zoom, y: -(sy - view.oy) / view.zoom }; }

    // --- FILE LOAD ---
    const loader    = document.getElementById('loading-overlay');
    const fileInput = document.getElementById('dxf-file');

    function processFile(file) {
        if (!file) return;
        loader.style.display = 'flex';
        setTimeout(() => {
            const r = new FileReader();
            r.onload = evt => {
                try {
                    const P = window.DxfParser;
                    if (!P) throw new Error('dxf-parser no disponible');
                    dxfData = new P().parseSync(evt.target.result);
                    buildEntities(dxfData);
                } catch(e) {
                    alert('Error DXF: ' + e.message + '\nGuarde como DXF AutoCAD 2013 ASCII.');
                } finally {
                    loader.style.display = 'none';
                    if (fileInput) fileInput.value = '';
                }
            };
            r.readAsText(file);
        }, 300);
    }

    fileInput.addEventListener('change', e => processFile(e.target.files[0]));
    wrapper.addEventListener('dragover', e => { e.preventDefault(); wrapper.style.outline = '4px dashed #3b82f6'; });
    wrapper.addEventListener('dragleave', e => { e.preventDefault(); wrapper.style.outline = 'none'; });
    wrapper.addEventListener('drop', e => {
        e.preventDefault(); wrapper.style.outline = 'none';
        const f = e.dataTransfer.files[0];
        if (f && f.name.toLowerCase().endsWith('.dxf')) processFile(f);
        else alert('Solo archivos .dxf');
    });

    // --- FLATTEN ENTITIES (expand INSERT blocks) ---
    function buildEntities(data) {
        layers = {};
        userMeas = [];
        measState = 0;
        mPt1 = null;
        allEntities = [];

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        function upd(x, y) { if (!isFinite(x)||!isFinite(y)) return; minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y); }

        function flatten(ents, ox, oy, sx, sy, rot) {
            (ents || []).forEach(ent => {
                try {
                    const ln = ent.layer || '0';
                    if (!layers[ln]) layers[ln] = { visible: true };

                    // Transform entity coords into world space
                    function tx(x, y) {
                        // apply scale, then rotation, then offset
                        let nx = x * sx, ny = y * sy;
                        if (rot) {
                            const c = Math.cos(rot), s = Math.sin(rot);
                            let tmp = nx*c - ny*s; ny = nx*s + ny*c; nx = tmp;
                        }
                        return { x: nx + ox, y: ny + oy };
                    }

                    if (ent.type === 'LINE' && ent.vertices && ent.vertices.length >= 2) {
                        const p1 = tx(ent.vertices[0].x, ent.vertices[0].y);
                        const p2 = tx(ent.vertices[1].x, ent.vertices[1].y);
                        allEntities.push({ type: 'LINE', layer: ln, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
                        upd(p1.x,p1.y); upd(p2.x,p2.y);
                    } else if ((ent.type==='LWPOLYLINE'||ent.type==='POLYLINE') && ent.vertices) {
                        const vs = ent.vertices.map(v => { const p=tx(v.x,v.y); return {...p, bulge: v.bulge||0}; });
                        vs.forEach(v => upd(v.x,v.y));
                        allEntities.push({ type: 'PLINE', layer: ln, vertices: vs, closed: !!(ent.closed||ent.shape) });
                    } else if (ent.type==='CIRCLE' && ent.center) {
                        const c = tx(ent.center.x, ent.center.y);
                        const r = ent.radius * Math.max(sx, sy);
                        allEntities.push({ type: 'CIRCLE', layer: ln, cx: c.x, cy: c.y, r });
                        upd(c.x-r,c.y); upd(c.x+r,c.y);
                    } else if (ent.type==='ARC' && ent.center) {
                        const c = tx(ent.center.x, ent.center.y);
                        const r = ent.radius * Math.max(sx, sy);
                        allEntities.push({ type: 'ARC', layer: ln, cx: c.x, cy: c.y, r, sa: ent.startAngle||0, ea: ent.endAngle||0 });
                        upd(c.x-r,c.y); upd(c.x+r,c.y);
                    } else if (ent.type==='ELLIPSE' && ent.center && ent.majorAxisEndPoint) {
                        const c = tx(ent.center.x, ent.center.y);
                        const rx = Math.sqrt(ent.majorAxisEndPoint.x**2+ent.majorAxisEndPoint.y**2);
                        const ry = rx*(ent.axisRatio||1);
                        const rotat = Math.atan2(ent.majorAxisEndPoint.y, ent.majorAxisEndPoint.x);
                        allEntities.push({ type: 'ELLIPSE', layer: ln, cx: c.x, cy: c.y, rx, ry, rot: rotat, sa: ent.startAngle||0, ea: ent.endAngle||Math.PI*2 });
                        upd(c.x-rx,c.y); upd(c.x+rx,c.y);
                    } else if (ent.type==='SPLINE') {
                        const pts = (ent.fitPoints&&ent.fitPoints.length>0)?ent.fitPoints:ent.controlPoints||[];
                        if (pts.length>1) {
                            const tpts = pts.map(p=>tx(p.x,p.y));
                            tpts.forEach(p=>upd(p.x,p.y));
                            allEntities.push({ type:'SPLINE', layer:ln, pts:tpts });
                        }
                    } else if (ent.type==='INSERT') {
                        const block = data.blocks&&data.blocks[ent.name];
                        if (block&&block.entities) {
                            const bx=(ent.position?ent.position.x:0)*sx+ox;
                            const by=(ent.position?ent.position.y:0)*sy+oy;
                            const bsx=(ent.scaleX||1)*sx, bsy=(ent.scaleY||1)*sy;
                            const br=(ent.rotation||0)*Math.PI/180+rot;
                            flatten(block.entities, bx, by, bsx, bsy, br);
                        }
                    }
                } catch(e) { console.warn('entity err:', e); }
            });
        }

        flatten(data.entities, 0, 0, 1, 1, 0);
        if (!isFinite(minX)) { minX=0;maxX=500;minY=0;maxY=500; }
        bbox = { minX, maxX, minY, maxY };
        buildLayers();
        fitView();
    }

    // --- LAYERS UI ---
    function buildLayers() {
        const cont = document.getElementById('layers-container');
        document.getElementById('layers-count').textContent = Object.keys(layers).length;
        cont.innerHTML = '';
        Object.keys(layers).forEach(ln => {
            const d = document.createElement('div');
            d.className = 'layer-item flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700/80 cursor-pointer';
            const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=true;
            cb.addEventListener('change',()=>{ layers[ln].visible=cb.checked; requestRender(); });
            const sp = document.createElement('span'); sp.className='text-xs truncate'; sp.textContent=ln; sp.title=ln;
            d.appendChild(cb); d.appendChild(sp);
            d.addEventListener('click',e=>{ if(e.target!==cb){cb.checked=!cb.checked;layers[ln].visible=cb.checked;requestRender();} });
            cont.appendChild(d);
        });
    }

    // --- FIT VIEW ---
    function fitView() {
        const { minX, maxX, minY, maxY } = bbox;
        const dw=maxX-minX, dh=maxY-minY;
        const cw=canvas.width, ch=canvas.height, pad=40;
        if (dw>0&&dh>0) {
            view.zoom = Math.min((cw-pad*2)/dw,(ch-pad*2)/dh);
            view.ox = cw/2 - (minX+maxX)/2*view.zoom;
            view.oy = ch/2 + (minY+maxY)/2*view.zoom;
        }
        requestRender();
    }

    // --- BUTTONS ---
    document.getElementById('btn-reset-view').addEventListener('click', fitView);
    document.getElementById('btn-clear-meas').addEventListener('click', ()=>{ userMeas=[];measState=0;mPt1=null;requestRender(); });
    document.getElementById('btn-export-pdf').addEventListener('click', ()=>{
        if (!window.html2pdf) return;
        window.html2pdf().set({margin:10,filename:'plano.pdf',image:{type:'jpeg',quality:0.98},html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4',orientation:'landscape'}}).from(wrapper).save();
    });
    document.querySelectorAll('.toolbox-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('.toolbox-btn').forEach(b=>b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            view.tool = e.currentTarget.getAttribute('data-tool');
            canvas.style.cursor = view.tool==='pan'?'grab':'crosshair';
            document.getElementById('tool-hint').textContent = view.tool==='pan'
                ? 'Rueda ratón para Zoom. Arrastrar para Moverse.'
                : 'Click en círculo/arco → Diámetro. Dos clicks → Distancia.';
            measState=0; mPt1=null; requestRender();
        });
    });

    // --- MOUSE ---
    canvas.addEventListener('mousedown', e => {
        const mx=e.offsetX, my=e.offsetY;
        if (view.tool==='pan') {
            view.dragging=true; view.dsx=mx-view.ox; view.dsy=my-view.oy;
            canvas.style.cursor='grabbing';
        } else {
            handleMeasure(mx, my);
        }
    });
    canvas.addEventListener('mousemove', e => {
        const mx=e.offsetX, my=e.offsetY;
        mouseScr={x:mx,y:my};
        const w=s2w(mx,my);
        document.getElementById('coord-x').textContent=w.x.toFixed(2);
        document.getElementById('coord-y').textContent=w.y.toFixed(2);
        if (view.dragging) { view.ox=mx-view.dsx; view.oy=my-view.dsy; }
        requestRender();
    });
    canvas.addEventListener('mouseup', ()=>{ view.dragging=false; if(view.tool==='pan') canvas.style.cursor='grab'; });
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const d=e.deltaY>0?0.85:1.15, mx=e.offsetX, my=e.offsetY;
        const before=s2w(mx,my);
        view.zoom=Math.max(0.0001,Math.min(100000,view.zoom*d));
        const after=w2s(before.x,before.y);
        view.ox+=mx-after.x; view.oy+=my-after.y;
        requestRender();
    }, {passive:false});

    // --- MEASURE ---
    function handleMeasure(mx, my) {
        const w = s2w(mx, my);
        const tol = 12 / view.zoom;

        // Circle hit test
        let hit = null;
        allEntities.forEach(ent => {
            if (hit) return;
            if (!layers[ent.layer]||!layers[ent.layer].visible) return;
            if (ent.type==='CIRCLE') {
                const dc=Math.hypot(w.x-ent.cx,w.y-ent.cy);
                if (dc<tol||Math.abs(dc-ent.r)<tol) hit={type:'diameter',cx:ent.cx,cy:ent.cy,r:ent.r};
            } else if (ent.type==='ARC') {
                const dc=Math.hypot(w.x-ent.cx,w.y-ent.cy);
                if (Math.abs(dc-ent.r)<tol) hit={type:'diameter',cx:ent.cx,cy:ent.cy,r:ent.r};
            }
        });
        if (hit && measState===0) { userMeas.push(hit); requestRender(); return; }

        if (measState===0||measState===2) { measState=1; mPt1={wx:w.x,wy:w.y}; }
        else { userMeas.push({type:'line',x1:mPt1.wx,y1:mPt1.wy,x2:w.x,y2:w.y,dist:Math.hypot(w.x-mPt1.wx,w.y-mPt1.wy)}); measState=2; mPt1=null; }
        requestRender();
    }

    // --- RENDER ---
    function requestRender() { if(!renderReq){renderReq=true;requestAnimationFrame(render);} }

    function render() {
        renderReq=false;
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const dark=htmlEl.classList.contains('dark');

        if (!allEntities.length) {
            ctx.fillStyle=dark?'#9ca3af':'#6b7280';
            ctx.font='italic 14px sans-serif'; ctx.textAlign='center';
            ctx.fillText('Espacio Vacío. Cargue un archivo .DXF.',canvas.width/2,canvas.height/2);
            return;
        }

        const stroke=dark?'rgba(255,255,255,0.8)':'rgba(0,0,0,0.85)';
        ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.lineJoin='round'; ctx.lineCap='round';

        allEntities.forEach(ent => {
            if (!layers[ent.layer]||!layers[ent.layer].visible) return;
            ctx.beginPath();
            ctx.strokeStyle=stroke;

            if (ent.type==='LINE') {
                const p1=w2s(ent.x1,ent.y1), p2=w2s(ent.x2,ent.y2);
                ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();

            } else if (ent.type==='PLINE') {
                drawPolyline(ent);

            } else if (ent.type==='CIRCLE') {
                const c=w2s(ent.cx,ent.cy), r=ent.r*view.zoom;
                ctx.arc(c.x,c.y,r,0,Math.PI*2); ctx.stroke();

            } else if (ent.type==='ARC') {
                drawArc(ent.cx,ent.cy,ent.r,ent.sa,ent.ea);

            } else if (ent.type==='ELLIPSE') {
                if (ctx.ellipse) {
                    const c=w2s(ent.cx,ent.cy);
                    ctx.ellipse(c.x,c.y,ent.rx*view.zoom,ent.ry*view.zoom,-ent.rot,ent.sa,ent.ea,true);
                    ctx.stroke();
                }
            } else if (ent.type==='SPLINE') {
                if (ent.pts.length>1) {
                    const p0=w2s(ent.pts[0].x,ent.pts[0].y);
                    ctx.moveTo(p0.x,p0.y);
                    ent.pts.slice(1).forEach(p=>{ const s=w2s(p.x,p.y); ctx.lineTo(s.x,s.y); });
                    ctx.stroke();
                }
            }
        });

        // Measures
        drawMeasures(dark);
    }

    // ====================================================
    //  ARC MATH - VERIFIED CORRECT
    //  DXF: startAngle -> endAngle in degrees, CCW in Y-up space
    //  Canvas: Y-down. Conversion:
    //    screen_angle = atan2(-sin(dxf_deg), cos(dxf_deg)) = -dxf_deg_in_radians
    //  After negating angles:
    //    DXF CCW arc (increasing angle) -> screen DECREASING angle
    //    Decreasing angle in canvas (Y-down) = counterclockwise=true
    //  VERIFIED with DXF ARC sa=180 ea=270 (lower-left quadrant):
    //    sa_s=-pi=-180deg, ea_s=-3pi/2 equiv 90deg
    //    going CCW (decreasing) from -180 -> -270: visits -210,-240,-270
    //    cos(-210)=-0.87 sin(-210)=+0.5 => lower-left area ✓
    //    cos(-270)=0 sin(-270)=+1 => directly below center ✓
    // ====================================================
    function drawArc(cx, cy, r, sa_deg, ea_deg) {
        const c = w2s(cx, cy);
        const rs = r * view.zoom;
        // Negate angles for Y-flip
        const sa = -sa_deg * Math.PI / 180;
        const ea = -ea_deg * Math.PI / 180;
        // counterclockwise=true: draws 90 deg arc correctly (not 270 deg)
        ctx.arc(c.x, c.y, rs, sa, ea, true);
        ctx.stroke();
    }

    // ====================================================
    //  POLYLINE WITH BULGE
    //  Bulge sign: +1 = CCW (DXF), -1 = CW
    //  Center: midpoint ± perpendicular * centerDist
    //  LEFT of P1→P2 for CCW (+ bulge) = rotate chord by +90° CCW
    // ====================================================
    function drawPolyline(ent) {
        const vs = ent.vertices;
        if (!vs||vs.length<2) return;
        const p0=w2s(vs[0].x,vs[0].y);
        ctx.moveTo(p0.x,p0.y);

        for (let i=0;i<vs.length;i++) {
            const v1=vs[i];
            const nextI=(i+1<vs.length)?i+1:(ent.closed?0:-1);
            if (nextI===-1) break;
            const v2=vs[nextI];

            if (!v1.bulge||Math.abs(v1.bulge)<1e-6) {
                const s=w2s(v2.x,v2.y); ctx.lineTo(s.x,s.y);
            } else {
                drawBulgeArc(v1,v2,v1.bulge);
            }
        }
        ctx.stroke();
    }

    // ====================================================
    //  POLYLINE BULGE ARC (LWPOLYLINE)
    //  Bulge: + = CCW in DXF = CW on screen (Y-flip)
    //  Center: to the LEFT of P1→P2 for CCW (+ bulge)
    //    LEFT = rotate +90° from chord: centerAngle = chordAngle + PI/2
    //    But when sgn=+1 (CCW/left), multiply by +1
    //    When sgn=-1 (CW/right), multiply by -1
    // ====================================================
    function drawBulgeArc(v1, v2, bulge) {
        const dx=v2.x-v1.x, dy=v2.y-v1.y;
        const dist=Math.hypot(dx,dy);
        if (dist<1e-10) return;

        const ab=Math.abs(bulge);
        const r=dist*(ab*ab+1)/(4*ab);

        // Distance from chord midpoint to arc center
        const h2=r*r-(dist/2)*(dist/2);
        const h=h2>0?Math.sqrt(h2):0;

        // Center is to LEFT of P1→P2 for positive bulge (CCW in DXF)
        // LEFT = perpendicular CCW from chord direction = chordAngle + PI/2
        const chordAngle=Math.atan2(dy,dx);
        const perpAngle=chordAngle+Math.PI/2;
        const sgn=Math.sign(bulge);

        const midX=(v1.x+v2.x)/2, midY=(v1.y+v2.y)/2;
        const arcCx=midX+sgn*h*Math.cos(perpAngle);
        const arcCy=midY+sgn*h*Math.sin(perpAngle);

        // Angles from arc center to P1 and P2 in DXF world coords
        const aDxfStart=Math.atan2(v1.y-arcCy,v1.x-arcCx);
        const aDxfEnd=Math.atan2(v2.y-arcCy,v2.x-arcCx);

        // Convert to screen space (negate for Y-flip)
        const aScStart=-aDxfStart;
        const aScEnd=-aDxfEnd;

        const rs=r*view.zoom;
        const sc=w2s(arcCx,arcCy);

        // DXF +bulge = CCW = screen DECREASING angle = counterclockwise=true
        // DXF -bulge = CW = screen INCREASING angle = counterclockwise=false
        ctx.arc(sc.x,sc.y,rs,aScStart,aScEnd,bulge>0);
    }

    // --- DRAW MEASURES ---
    function drawMeasures(dark) {
        ctx.lineWidth=2;
        userMeas.forEach(m => {
            if (m.type==='diameter') {
                const c=w2s(m.cx,m.cy), r=m.r*view.zoom;
                ctx.beginPath(); ctx.strokeStyle='#3b82f6';
                ctx.arc(c.x,c.y,r,0,Math.PI*2); ctx.stroke();
                const lbl='Ø '+( m.r*2).toFixed(3);
                ctx.font='bold 13px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
                const tw=ctx.measureText(lbl).width;
                ctx.fillStyle=dark?'rgba(0,0,0,0.75)':'rgba(255,255,255,0.85)';
                ctx.fillRect(c.x-tw/2-4,c.y-10,tw+8,20);
                ctx.fillStyle=dark?'#93c5fd':'#1d4ed8'; ctx.fillText(lbl,c.x,c.y);
            } else {
                const p1=w2s(m.x1,m.y1),p2=w2s(m.x2,m.y2);
                ctx.beginPath(); ctx.strokeStyle='#ef4444';
                ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
                ctx.fillStyle='#ef4444';
                [p1,p2].forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();});
                const mx=(p1.x+p2.x)/2,my=(p1.y+p2.y)/2,lbl=m.dist.toFixed(3);
                ctx.font='bold 13px monospace'; const tw=ctx.measureText(lbl).width;
                ctx.fillStyle=dark?'rgba(0,0,0,0.6)':'rgba(255,255,255,0.85)';
                ctx.fillRect(mx-tw/2-3,my-15,tw+6,16);
                ctx.fillStyle=dark?'#fca5a5':'#7f1d1d';
                ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.fillText(lbl,mx,my-2);
            }
        });
        // Live preview
        if (view.tool==='measure'&&measState===1&&mPt1) {
            const p1=w2s(mPt1.wx,mPt1.wy);
            const wp=s2w(mouseScr.x,mouseScr.y);
            const dist=Math.hypot(wp.x-mPt1.wx,wp.y-mPt1.wy);
            ctx.beginPath(); ctx.setLineDash([5,5]); ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1.5;
            ctx.moveTo(p1.x,p1.y); ctx.lineTo(mouseScr.x,mouseScr.y); ctx.stroke(); ctx.setLineDash([]);
            const lbl=dist.toFixed(3); ctx.font='bold 13px monospace';
            const tw=ctx.measureText(lbl).width;
            ctx.fillStyle=dark?'rgba(0,0,0,0.85)':'rgba(255,255,255,0.9)';
            ctx.fillRect(mouseScr.x+12,mouseScr.y-20,tw+8,20);
            ctx.fillStyle=dark?'#93c5fd':'#1d4ed8';
            ctx.textAlign='left'; ctx.textBaseline='bottom'; ctx.fillText(lbl,mouseScr.x+16,mouseScr.y-4);
        }
    }

    requestRender();
});
