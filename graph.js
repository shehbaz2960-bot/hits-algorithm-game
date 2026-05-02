/**
 * Graph Engine — Fixed: stable physics, readable nodes, proper positioning
 */

class Graph {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nodes = [];
    this.edges = [];
    this.nextId = 0;

    this.physics = {
      repulsion: 6000,
      attraction: 0.012,
      damping: 0.75,
      gravity: 0.008,
      running: false,
      tickCount: 0
    };

    this.dragging = null;
    this.hoveredNode = null;
    this.selectedNode = null;
    this.linkSource = null;
    this.mode = 'select';
    this.animFrame = null;
    this.pulsePhase = 0;
    this.mousePos = null;

    this._bindEvents();
    this._startRenderLoop();
  }

  addNode(x, y, label = null) {
    const id = this.nextId++;
    const r = 34;
    const W = this.canvas.width, H = this.canvas.height;
    this.nodes.push({
      id,
      x: x != null ? Math.max(r, Math.min(W - r, x)) : (r + Math.random() * (W - 2 * r)),
      y: y != null ? Math.max(r + 50, Math.min(H - r - 30, y)) : (r + 50 + Math.random() * (H - 2 * r - 80)),
      vx: 0, vy: 0,
      label: label ?? String.fromCharCode(65 + (id % 26)),
      hub: 0, authority: 0,
      radius: 34, isTarget: false
    });
    return id;
  }

  addEdge(from, to) {
    if (from === to) return false;
    if (this.edges.find(e => e.from === from && e.to === to)) return false;
    this.edges.push({ from, to, id: `${from}-${to}` });
    return true;
  }

  removeNode(id) {
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
  }

  removeEdge(from, to) {
    this.edges = this.edges.filter(e => !(e.from === from && e.to === to));
  }

  clear() { this.nodes = []; this.edges = []; this.nextId = 0; }

  getEdgeList() { return this.edges.map(e => [e.from, e.to]); }

  updateScores(hubs, authorities) {
    this.nodes.forEach(n => {
      if (hubs[n.id] !== undefined) { n.hub = hubs[n.id]; n.authority = authorities[n.id]; }
    });
  }

  startPhysics() { this.physics.running = true; this.physics.tickCount = 0; }
  stopPhysics()  { this.physics.running = false; }

  tickPhysics() {
    if (!this.physics.running || this.nodes.length === 0) return;
    this.physics.tickCount++;
    if (this.physics.tickCount > 300) { this.physics.running = false; return; }

    const { repulsion, attraction, damping, gravity } = this.physics;
    const W = this.canvas.width, H = this.canvas.height;
    const cx = W / 2, cy = H / 2;

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i], b = this.nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx*dx + dy*dy), 30);
        const force = Math.min(repulsion / (dist*dist), 8);
        const fx = (dx/dist)*force, fy = (dy/dist)*force;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
      }
    }

    for (const e of this.edges) {
      const a = this.nodes.find(n => n.id === e.from);
      const b = this.nodes.find(n => n.id === e.to);
      if (!a || !b) continue;
      const dx = b.x-a.x, dy = b.y-a.y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      const force = attraction * (dist - 150);
      a.vx += dx*force; a.vy += dy*force;
      b.vx -= dx*force; b.vy -= dy*force;
    }

    for (const n of this.nodes) { n.vx += (cx-n.x)*gravity; n.vy += (cy-n.y)*gravity; }

    const maxV = 6;
    for (const n of this.nodes) {
      if (this.dragging === n.id) continue;
      n.vx = Math.max(-maxV, Math.min(maxV, n.vx*damping));
      n.vy = Math.max(-maxV, Math.min(maxV, n.vy*damping));
      n.x += n.vx; n.y += n.vy;
      const pad = n.radius + 12;
      n.x = Math.max(pad, Math.min(W-pad, n.x));
      n.y = Math.max(pad+50, Math.min(H-pad-30, n.y));
    }
  }

  _startRenderLoop() {
    const tick = () => {
      this.pulsePhase += 0.035;
      this.tickPhysics();
      this.render();
      this.animFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    this._drawGrid(ctx, W, H);
    for (const e of this.edges) {
      const from = this.nodes.find(n => n.id === e.from);
      const to   = this.nodes.find(n => n.id === e.to);
      if (from && to) this._drawEdge(ctx, from, to);
    }
    if (this.linkSource !== null && this.mousePos) {
      const src = this.nodes.find(n => n.id === this.linkSource);
      if (src) {
        ctx.save();
        ctx.strokeStyle = '#00f5ff'; ctx.lineWidth = 2;
        ctx.setLineDash([8,4]); ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(this.mousePos.x, this.mousePos.y); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
    }
    for (const n of this.nodes) this._drawNode(ctx, n);
  }

  _drawGrid(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,245,255,0.04)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.restore();
  }

  _drawEdge(ctx, from, to) {
    const dx = to.x-from.x, dy = to.y-from.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if (dist < 1) return;
    const ux = dx/dist, uy = dy/dist;
    const startX = from.x + ux*from.radius, startY = from.y + uy*from.radius;
    const endX = to.x - ux*(to.radius+12), endY = to.y - uy*(to.radius+12);
    const alpha = 0.35 + Math.max(from.hub, 0.1)*0.45;

    ctx.save();
    ctx.strokeStyle = `rgba(0,245,255,${alpha})`;
    ctx.lineWidth = 1.5 + Math.max(from.hub,0)*2;
    ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.moveTo(startX,startY); ctx.lineTo(endX,endY); ctx.stroke();

    const angle = Math.atan2(uy, ux), aSize = 11;
    ctx.fillStyle = `rgba(0,245,255,${alpha+0.2})`;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - aSize*Math.cos(angle-0.45), endY - aSize*Math.sin(angle-0.45));
    ctx.lineTo(endX - aSize*Math.cos(angle+0.45), endY - aSize*Math.sin(angle+0.45));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  _drawNode(ctx, n) {
    const isHovered = this.hoveredNode === n.id;
    const isLinkSrc = this.linkSource === n.id;
    const isSelected = this.selectedNode === n.id;
    const pulse = Math.sin(this.pulsePhase + n.id*1.1)*0.5+0.5;
    const r = n.radius;

    ctx.save();

    if (n.isTarget) {
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 25+pulse*12;
      ctx.strokeStyle = `rgba(255,215,0,${0.6+pulse*0.4})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(n.x, n.y, r+9+pulse*3, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (isSelected || isLinkSrc) {
      ctx.strokeStyle = isLinkSrc ? '#00f5ff' : '#ffffff'; ctx.lineWidth = 3;
      ctx.shadowColor = isLinkSrc ? '#00f5ff' : '#fff'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(n.x, n.y, r+6, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Dark base
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI*2);
    ctx.fillStyle = '#0a0e1f'; ctx.fill();

    // Hub half (green, left)
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, Math.PI/2, -Math.PI/2, true);
    ctx.lineTo(n.x, n.y); ctx.closePath();
    ctx.fillStyle = `rgba(0,255,140,${0.15+Math.max(n.hub,0)*0.85})`; ctx.fill();

    // Authority half (gold, right)
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, -Math.PI/2, Math.PI/2, false);
    ctx.lineTo(n.x, n.y); ctx.closePath();
    ctx.fillStyle = `rgba(255,210,0,${0.15+Math.max(n.authority,0)*0.85})`; ctx.fill();

    // Border
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI*2);
    ctx.strokeStyle = isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    ctx.shadowColor = isHovered ? '#fff' : 'transparent';
    ctx.shadowBlur = isHovered ? 8 : 0;
    ctx.stroke();

    // Divider
    ctx.beginPath(); ctx.moveTo(n.x, n.y-r+4); ctx.lineTo(n.x, n.y+r-4);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.stroke();

    // Label
    ctx.fillStyle = '#ffffff'; ctx.font = "bold 16px 'Courier New', monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
    ctx.fillText(n.label, n.x, n.y-8);

    // Scores
    ctx.font = "bold 10px 'Courier New', monospace"; ctx.shadowBlur = 0;
    ctx.fillStyle = '#00ff8c';
    ctx.fillText(`H:${n.hub.toFixed(2)}`, n.x - r/2+2, n.y+10);
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`A:${n.authority.toFixed(2)}`, n.x + r/2-2, n.y+10);

    ctx.restore();
  }

  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width/rect.width, scaleY = this.canvas.height/rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX-rect.left)*scaleX, y: (clientY-rect.top)*scaleY };
  }

  _nodeAt(x, y) {
    for (let i = this.nodes.length-1; i >= 0; i--) {
      const n = this.nodes[i];
      const dx = n.x-x, dy = n.y-y;
      if (Math.sqrt(dx*dx+dy*dy) < n.radius+8) return n;
    }
    return null;
  }

  _bindEvents() {
    const c = this.canvas;
    c.addEventListener('mousemove', e => {
      const pos = this._getPos(e); this.mousePos = pos;
      const n = this._nodeAt(pos.x, pos.y);
      this.hoveredNode = n ? n.id : null;
      c.style.cursor = n ? 'pointer' : (this.mode==='addNode'?'crosshair':'default');
      if (this.dragging !== null) {
        const node = this.nodes.find(nd => nd.id===this.dragging);
        if (node) { node.x=pos.x; node.y=pos.y; node.vx=0; node.vy=0; }
      }
    });
    c.addEventListener('mousedown', e => {
      const pos = this._getPos(e); const n = this._nodeAt(pos.x, pos.y);
      if (n && this.mode==='select') { this.dragging=n.id; this.selectedNode=n.id; this.onNodeSelect&&this.onNodeSelect(n); }
    });
    c.addEventListener('mouseup', () => { this.dragging = null; });
    c.addEventListener('click', e => {
      const pos = this._getPos(e); const n = this._nodeAt(pos.x, pos.y);
      if (this.mode==='addNode' && !n) { const id=this.addNode(pos.x,pos.y); this.onGraphChange&&this.onGraphChange('addNode',id); return; }
      if (this.mode==='addEdge') {
        if (n) {
          if (this.linkSource===null) { this.linkSource=n.id; }
          else { if(this.addEdge(this.linkSource,n.id)) this.onGraphChange&&this.onGraphChange('addEdge',{from:this.linkSource,to:n.id}); this.linkSource=null; }
        } else { this.linkSource=null; }
        return;
      }
      if (this.mode==='delete' && n) { this.removeNode(n.id); this.onGraphChange&&this.onGraphChange('removeNode',n.id); return; }
      if (!n) { this.selectedNode=null; this.onNodeSelect&&this.onNodeSelect(null); }
    });
    c.addEventListener('dblclick', e => {
      const pos = this._getPos(e); const n = this._nodeAt(pos.x, pos.y);
      if (!n && this.mode==='select') { const id=this.addNode(pos.x,pos.y); this.onGraphChange&&this.onGraphChange('addNode',id); }
    });
  }

  destroy() { cancelAnimationFrame(this.animFrame); }
}