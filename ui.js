/**
 * UI Controller
 * Manages screens, wires game engine to DOM, handles all UI events
 */

// ── Canvas sizing ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('graph-canvas');

function resizeCanvas() {
  const wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── Global instances ──────────────────────────────────────────────────────────
const graph  = new Graph(canvas);
const engine = new GameEngine(graph);

// ── Screen management ─────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'screen-game') resizeCanvas();
}

function showMenu()      { showScreen('screen-menu'); }
function showExplainer() { showScreen('screen-explainer'); }

function showLevels() {
  renderLevelCards();
  showScreen('screen-levels');
}

// ── Level cards ───────────────────────────────────────────────────────────────
function renderLevelCards() {
  const grid = document.getElementById('levels-grid');
  const levels = engine.getLevels();
  grid.innerHTML = '';
  levels.forEach((lvl, i) => {
    const locked = !engine.unlockedLevels.includes(i);
    const card = document.createElement('div');
    card.className = 'level-card' + (locked ? ' locked' : '');
    card.innerHTML = `
      <div class="level-num">${String(lvl.id).padStart(2,'0')}</div>
      <div class="level-name">${lvl.name}</div>
      <div class="level-desc">${lvl.description}</div>
      ${locked ? '<div class="lock-icon">🔒</div>' : ''}
    `;
    if (!locked) card.addEventListener('click', () => startLevel(i));
    grid.appendChild(card);
  });
}

// ── Start level ───────────────────────────────────────────────────────────────
function startLevel(index) {
  hideOverlays();
  showScreen('screen-game');
  graph.startPhysics();

  const lvl = engine.getLevels()[index];
  document.getElementById('hud-level-name').textContent = `LVL ${lvl.id} · ${lvl.name.toUpperCase()}`;
  document.getElementById('hud-objective-text').textContent = lvl.description;
  document.getElementById('hint-text').textContent = lvl.hint;

  // Wire engine callbacks
  engine.onTick = (t) => {
    const el = document.getElementById('hud-timer');
    el.textContent = t;
    el.classList.toggle('urgent', t <= 10);
  };

  engine.onActionUsed = (a) => {
    document.getElementById('hud-actions').textContent = a;
  };

  engine.onHITSUpdate = (result) => {
    document.getElementById('hits-iters').textContent =
      `Converged in ${result.iterations} iterations`;
    renderScores();
  };

  engine.onWin = ({ score, timeLeft, actionsLeft }) => {
    document.getElementById('win-score').textContent = `+${score.toLocaleString()} pts`;
    document.getElementById('win-msg').textContent =
      `Time left: ${timeLeft}s · Moves left: ${actionsLeft}`;
    document.getElementById('hud-score').textContent = engine.totalScore.toLocaleString();

    const nextBtn = document.getElementById('btn-next-level');
    const nextIndex = engine.levelIndex + 1;
    if (nextIndex < engine.getLevels().length) {
      nextBtn.style.display = '';
      nextBtn.onclick = () => { hideOverlays(); startLevel(nextIndex); };
    } else {
      nextBtn.style.display = 'none';
    }

    document.getElementById('overlay-win').classList.add('active');
  };

  engine.onLose = ({ reason }) => {
    document.getElementById('lose-msg').textContent =
      reason === 'timeout' ? 'Time ran out before reaching the objective.' :
      'All moves used — objective not yet reached.';
    document.getElementById('overlay-lose').classList.add('active');
  };

  engine.loadLevel(index);
  setTool('addEdge');
  renderScores();
  updateTimerDisplay();
  updateActionsDisplay();
}

// ── Sandbox ───────────────────────────────────────────────────────────────────
function startSandbox() {
  hideOverlays();
  showScreen('screen-game');
  graph.startPhysics();

  document.getElementById('hud-level-name').textContent = 'SANDBOX MODE';
  document.getElementById('hud-objective-text').textContent = 'Free exploration — build any graph!';
  document.getElementById('hint-text').textContent = 'Double-click canvas to add a node. Use Add Link tool to connect them.';
  document.getElementById('hud-timer').textContent = '∞';
  document.getElementById('hud-actions').textContent = '∞';
  document.getElementById('hud-score').textContent = '—';
  document.getElementById('hits-iters').textContent = '';

  engine.onHITSUpdate = (result) => {
    document.getElementById('hits-iters').textContent =
      `Converged in ${result.iterations} iterations`;
    renderScores();
  };

  engine.onTick = null;
  engine.onWin  = null;
  engine.onLose = null;
  engine.onActionUsed = null;

  engine.loadSandbox();
  setTool('addEdge');

  // Add some starter nodes
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const r = 160;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    graph.addNode(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  engine.runHITS();
  renderScores();
}

// ── Scores panel ──────────────────────────────────────────────────────────────
function renderScores() {
  const list = document.getElementById('scores-list');
  list.innerHTML = '';

  const nodes = [...graph.nodes].sort((a, b) => b.authority - a.authority);
  const targetId = engine.currentLevel?.targetNode ?? null;

  nodes.forEach(n => {
    const row = document.createElement('div');
    row.className = 'score-row' + (n.id === targetId ? ' is-target' : '');

    row.innerHTML = `
      <div class="node-label">${n.label}${n.id === targetId ? ' ★' : ''}</div>
      <div class="score-bar-wrap">
        <div class="score-bar hub-bar" style="width:${Math.round(n.hub * 100)}%"></div>
        <span class="score-val">${n.hub.toFixed(3)}</span>
      </div>
      <div class="score-bar-wrap">
        <div class="score-bar auth-bar" style="width:${Math.round(n.authority * 100)}%"></div>
        <span class="score-val">${n.authority.toFixed(3)}</span>
      </div>
    `;
    list.appendChild(row);
  });
}

// ── Tool switching ────────────────────────────────────────────────────────────
function setTool(tool) {
  graph.mode = tool;
  graph.linkSource = null;
  graph.selectedNode = null;
  ['select','addNode','addEdge','delete'].forEach(t => {
    document.getElementById('tool-' + t)?.classList.toggle('active', t === tool);
  });
  const hints = {
    select: 'Click and drag nodes to reposition them. Click to select.',
    addNode: 'Click empty space to add a new node. Double-click also works.',
    addEdge: 'Click source node → click destination node to create a directed link.',
    delete: 'Click any node to remove it and all its links.'
  };
  document.getElementById('hint-text').textContent =
    hints[tool] || '';
}

// ── Hint toggle ───────────────────────────────────────────────────────────────
let hintVisible = true;
function toggleHint() {
  if (!engine.currentLevel) return;
  hintVisible = !hintVisible;
  document.getElementById('hint-text').textContent = hintVisible
    ? engine.currentLevel.hint
    : 'Hint hidden.';
}

// ── Overlay helpers ───────────────────────────────────────────────────────────
function hideOverlays() {
  document.getElementById('overlay-win').classList.remove('active');
  document.getElementById('overlay-lose').classList.remove('active');
}

// ── HUD helpers ───────────────────────────────────────────────────────────────
function updateTimerDisplay() {
  if (engine.currentLevel) {
    document.getElementById('hud-timer').textContent = engine.timeLeft;
  }
}
function updateActionsDisplay() {
  if (engine.currentLevel) {
    document.getElementById('hud-actions').textContent = engine.actionsLeft;
  }
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (document.getElementById('screen-game').classList.contains('active')) {
    const map = { 's': 'select', 'a': 'addNode', 'l': 'addEdge', 'd': 'delete' };
    if (map[e.key]) { setTool(map[e.key]); return; }
    if (e.key === 'Escape') { graph.linkSource = null; graph.selectedNode = null; }
    if (e.key === 'p' || e.key === 'P') engine.pause();
  }
});

// ── Startup ───────────────────────────────────────────────────────────────────
console.log('%c WEBRANK WARS — HITS Algorithm Game', 'color:#00f5ff;font-size:14px;font-weight:bold;');
console.log('%c Course: Analysis of Algorithms', 'color:#ffd700;font-size:11px;');
console.log('%c Algorithm: HITS (Kleinberg, 1999)', 'color:#00ff8c;font-size:11px;');
