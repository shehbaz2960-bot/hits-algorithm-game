/**
 * Graph Engine — Data structure + Canvas rendering
 * Handles node/edge management and force-directed layout
 */

class Graph {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nodes = [];
    this.edges = [];
    this.nextId = 0;

    // Force-directed layout parameters
    this.physics = {
      repulsion: 4500,
      attraction: 0.015,
      damping: 0.88,
      gravity: 0.02,
      running: false
    };

    // Interaction state
    this.dragging = null;
    this.hoveredNode = null;
    this.selectedNode = null;
    this.linkSource = null;
    this.mode = 'select'; // 'select' | 'addNode' | 'addEdge' | 'delete'

    // Visual state
    this.animFrame = null;
    this.pulsePhase = 0;

    this._bindEvents();
    this._startRenderLoop();
  }

  // ─── Graph Manipulation ────────────────────────────────────────────────────

  addNode(x, y, label = null) {
    const id = this.nextId++;
    this.nodes.push({
      id,
      x: x ?? (100 + Math.random() * (this.canvas.width - 200)),
      y: y ?? (100 + Math.random() * (this.canvas.height - 200)),
      vx: 0, vy: 0,
      label: label ?? String.fromCharCode(65 + (id % 26)) + (id >= 26 ? Math.floor(id/26) : ''),
      hub: 1,
      authority: 1,
      radius: 28,
      isTarget: false,
      type: 'page' // 'page' | 'hub' | 'authority'
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

  clear() {
    this.nodes = [];
    this.edges = [];
    this.nextId = 0;
  }

  getEdgeList() {
    return this.edges.map(e => [e.from, e.to]);
  }

  updateScores(hubs, authorities) {
    this.nodes.forEach((n, i) => {
      if (hubs[n.id] !== undefined) {
        n.hub = hubs[n.id];
        n.authority = authorities[n.id];
      }
    });
  }

  // ─── Force-Directed Layout ─────────────────────────────────────────────────

  startPhysics() {
    this.physics.running = true;
  }

  stopPhysics() {
    this.physics.running = false;
  }

  tickPhysics() {
    if (!this.physics.running || this.nodes.length === 0) return;

    const { repulsion, attraction, damping, gravity } = this.physics;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    // Repulsion between all node pairs
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i], b = this.nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx*dx + dy*dy), 1);
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    // Attraction along edges
    for (const e of this.edges) {
      const a = this.nodes.find(n => n.id === e.from);
      const b = this.nodes.find(n => n.id === e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const force = attraction * (dist - 120);
      a.vx += dx * force; a.vy += dy * force;
      b.vx -= dx * force; b.vy -= dy * force;
    }

    // Gravity toward center
    for (const n of this.nodes) {
      n.vx += (cx - n.x) * gravity;
      n.vy += (cy - n.y) * gravity;
    }

    // Integrate + dampen
    for (const n of this.nodes) {
      if (this.dragging === n.id) continue;
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
      // Boundary
      n.x = Math.max(n.radius + 10, Math.min(this.canvas.width - n.radius - 10, n.x));
      n.y = Math.max(n.radius + 10, Math.min(this.canvas.height - n.radius - 10, n.y));
    }
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  _startRenderLoop() {
    const tick = () => {
      this.pulsePhase += 0.04;
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

    // Draw grid background
    this._drawGrid(ctx, W, H);

    // Draw edges first
    for (const e of this.edges) {
      const from = this.nodes.find(n => n.id === e.from);
      const to   = this.nodes.find(n => n.id === e.to);
      if (from && to) this._drawEdge(ctx, from, to);
    }

    // Draw edge-in-progress
    if (this.linkSource !== null && this.mousePos) {
      const src = this.nodes.find(n => n.id === this.linkSource);
      if (src) {
        ctx.save();
        ctx.strokeStyle = '#00f5ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(this.mousePos.x, this.mousePos.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // Draw nodes
    for (const n of this.nodes) {
      this._drawNode(ctx, n);
    }
  }

  _drawGrid(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,245,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  _drawEdge(ctx, from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist === 0) return;
    const ux = dx/dist, uy = dy/dist;

    const startX = from.x + ux * from.radius;
    const startY = from.y + uy * from.radius;
    const endX   = to.x - ux * (to.radius + 10);
    const endY   = to.y - uy * (to.radius + 10);

    // Edge line
    const alpha = 0.25 + 0.4 * Math.max(from.hub, to.authority);
    ctx.save();
    ctx.strokeStyle = `rgba(0,245,255,${alpha})`;
    ctx.lineWidth = 1.5 + from.hub * 2;
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(uy, ux);
    const aSize = 10;
    ctx.fillStyle = `rgba(0,245,255,${alpha + 0.2})`;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - aSize * Math.cos(angle - 0.4), endY - aSize * Math.sin(angle - 0.4));
    ctx.lineTo(endX - aSize * Math.cos(angle + 0.4), endY - aSize * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawNode(ctx, n) {
    const isHovered  = this.hoveredNode === n.id;
    const isSelected = this.selectedNode === n.id;
    const isLinkSrc  = this.linkSource === n.id;
    const pulse = Math.sin(this.pulsePhase + n.id * 0.7) * 0.5 + 0.5;

    // Score-based color
    const authColor = this._lerpColor([20,20,60], [255,200,0], n.authority);
    const hubColor  = this._lerpColor([20,20,60], [0,245,100], n.hub);

    const r = n.radius;

    ctx.save();

    // Outer glow for target node
    if (n.isTarget) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 20 + pulse * 15;
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 8 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Selection ring
    if (isSelected || isLinkSrc) {
      ctx.strokeStyle = isLinkSrc ? '#00f5ff' : '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = isLinkSrc ? '#00f5ff' : '#fff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Node body — split circle: left = hub (green), right = authority (yellow)
    // Left half (hub)
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, Math.PI/2, -Math.PI/2, true);
    ctx.fillStyle = `rgb(${hubColor.join(',')})`;
    ctx.fill();

    // Right half (authority)
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, -Math.PI/2, Math.PI/2, true);
    ctx.fillStyle = `rgb(${authColor.join(',')})`;
    ctx.fill();

    // Border
    ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Divider line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(n.x, n.y - r);
    ctx.lineTo(n.x, n.y + r);
    ctx.stroke();

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${r > 25 ? 13 : 11}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(n.label, n.x, n.y - 3);

    // Score mini labels
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(0,255,100,0.9)';
    ctx.fillText(`H:${n.hub.toFixed(2)}`, n.x - r/2, n.y + r - 9);
    ctx.fillStyle = 'rgba(255,210,0,0.9)';
    ctx.fillText(`A:${n.authority.toFixed(2)}`, n.x + r/2, n.y + r - 9);

    ctx.restore();
  }

  _lerpColor(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    return [
      Math.round(a[0] + (b[0]-a[0]) * t),
      Math.round(a[1] + (b[1]-a[1]) * t),
      Math.round(a[2] + (b[2]-a[2]) * t)
    ];
  }

  // ─── Input Events ──────────────────────────────────────────────────────────

  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  _nodeAt(x, y) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const dx = n.x - x, dy = n.y - y;
      if (Math.sqrt(dx*dx + dy*dy) < n.radius + 6) return n;
    }
    return null;
  }

  _bindEvents() {
    const c = this.canvas;

    c.addEventListener('mousemove', e => {
      const pos = this._getPos(e);
      this.mousePos = pos;
      const n = this._nodeAt(pos.x, pos.y);
      this.hoveredNode = n ? n.id : null;
      c.style.cursor = n ? 'pointer' : (this.mode === 'addNode' ? 'crosshair' : 'default');
      if (this.dragging !== null) {
        const node = this.nodes.find(nd => nd.id === this.dragging);
        if (node) { node.x = pos.x; node.y = pos.y; node.vx = 0; node.vy = 0; }
      }
    });

    c.addEventListener('mousedown', e => {
      const pos = this._getPos(e);
      const n = this._nodeAt(pos.x, pos.y);
      if (n && this.mode === 'select') {
        this.dragging = n.id;
        this.selectedNode = n.id;
        this.onNodeSelect && this.onNodeSelect(n);
      }
    });

    c.addEventListener('mouseup', e => {
      this.dragging = null;
    });

    c.addEventListener('click', e => {
      const pos = this._getPos(e);
      const n = this._nodeAt(pos.x, pos.y);

      if (this.mode === 'addNode' && !n) {
        const id = this.addNode(pos.x, pos.y);
        this.onGraphChange && this.onGraphChange('addNode', id);
        return;
      }

      if (this.mode === 'addEdge') {
        if (n) {
          if (this.linkSource === null) {
            this.linkSource = n.id;
          } else {
            if (this.addEdge(this.linkSource, n.id)) {
              this.onGraphChange && this.onGraphChange('addEdge', { from: this.linkSource, to: n.id });
            }
            this.linkSource = null;
          }
        } else {
          this.linkSource = null;
        }
        return;
      }

      if (this.mode === 'delete' && n) {
        this.removeNode(n.id);
        this.onGraphChange && this.onGraphChange('removeNode', n.id);
        return;
      }

      if (!n) {
        this.selectedNode = null;
        this.onNodeSelect && this.onNodeSelect(null);
      }
    });

    c.addEventListener('dblclick', e => {
      const pos = this._getPos(e);
      const n = this._nodeAt(pos.x, pos.y);
      if (!n && this.mode === 'select') {
        const id = this.addNode(pos.x, pos.y);
        this.onGraphChange && this.onGraphChange('addNode', id);
      }
    });
  }

  destroy() {
    cancelAnimationFrame(this.animFrame);
  }
}
