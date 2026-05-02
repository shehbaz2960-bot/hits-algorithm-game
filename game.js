/**
 * Game Logic — Levels, Objectives, Scoring
 * Orchestrates the HITS algorithm game
 */

const LEVELS = [
  {
    id: 1,
    name: "First Link",
    description: "Add a link to node A to boost its authority above 0.6",
    hint: "Authority is gained by being linked to by Hub nodes. Add links that point TO node A!",
    timeLimit: 60,
    targetNode: 0,
    targetScore: 0.6,
    targetType: 'authority',
    preset: {
      nodes: [
        { label: 'A', x: 400, y: 250 },
        { label: 'B', x: 200, y: 150 },
        { label: 'C', x: 600, y: 150 },
        { label: 'D', x: 200, y: 350 },
      ],
      edges: [[1,2],[3,2],[1,3]]
    },
    maxActions: 5
  },
  {
    id: 2,
    name: "Hub Builder",
    description: "Make node B the top Hub — hub score above 0.7",
    hint: "Hubs point to many authorities. Make node B link out to nodes that have incoming links!",
    timeLimit: 75,
    targetNode: 1,
    targetScore: 0.7,
    targetType: 'hub',
    preset: {
      nodes: [
        { label: 'A', x: 150, y: 200 },
        { label: 'B', x: 400, y: 300 },
        { label: 'C', x: 650, y: 200 },
        { label: 'D', x: 400, y: 100 },
        { label: 'E', x: 200, y: 400 },
      ],
      edges: [[0,2],[0,3],[4,2],[4,3]]
    },
    maxActions: 4
  },
  {
    id: 3,
    name: "Web of Influence",
    description: "Reach authority > 0.65 for node A with limited moves",
    hint: "Think about which nodes are good hubs — their outgoing links determine authority!",
    timeLimit: 90,
    targetNode: 0,
    targetScore: 0.65,
    targetType: 'authority',
    preset: {
      nodes: [
        { label: 'A', x: 400, y: 300 },
        { label: 'B', x: 150, y: 150 },
        { label: 'C', x: 650, y: 150 },
        { label: 'D', x: 150, y: 450 },
        { label: 'E', x: 650, y: 450 },
        { label: 'F', x: 400, y: 100 },
      ],
      edges: [[1,2],[1,4],[3,2],[3,4],[5,2],[5,4]]
    },
    maxActions: 3
  },
  {
    id: 4,
    name: "Authority Wars",
    description: "Make node C the #1 authority, above all other nodes",
    hint: "Concentrate hub links on node C. The most-linked-to node by hubs wins!",
    timeLimit: 100,
    targetNode: 2,
    targetScore: null, // must be #1
    targetType: 'authority_rank',
    preset: {
      nodes: [
        { label: 'A', x: 200, y: 250 },
        { label: 'B', x: 400, y: 150 },
        { label: 'C', x: 600, y: 250 },
        { label: 'D', x: 300, y: 400 },
        { label: 'E', x: 500, y: 400 },
        { label: 'F', x: 100, y: 400 },
      ],
      edges: [[0,1],[3,1],[3,4],[5,0],[5,1]]
    },
    maxActions: 4
  },
  {
    id: 5,
    name: "The Grand Web",
    description: "Build a perfect hub-authority ecosystem: get 3 nodes above 0.5 authority",
    hint: "Design a real web: some nodes are hubs (link to many), some are authorities (linked by many)!",
    timeLimit: 120,
    targetNode: null,
    targetScore: 0.5,
    targetType: 'multi_authority',
    targetCount: 3,
    preset: {
      nodes: [
        { label: 'A', x: 200, y: 200 },
        { label: 'B', x: 400, y: 100 },
        { label: 'C', x: 600, y: 200 },
        { label: 'D', x: 150, y: 400 },
        { label: 'E', x: 650, y: 400 },
      ],
      edges: []
    },
    maxActions: 10
  }
];

class GameEngine {
  constructor(graph) {
    this.graph = graph;
    this.state = 'menu'; // 'menu' | 'playing' | 'paused' | 'win' | 'lose' | 'sandbox'
    this.currentLevel = null;
    this.levelIndex = 0;
    this.score = 0;
    this.totalScore = 0;
    this.actionsLeft = 0;
    this.timeLeft = 0;
    this.timerInterval = null;
    this.lastHITS = null;
    this.unlockedLevels = [0]; // start with level 1 unlocked

    // Callbacks
    this.onTick = null;
    this.onWin = null;
    this.onLose = null;
    this.onScoreUpdate = null;
    this.onHITSUpdate = null;
    this.onActionUsed = null;
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.currentLevel = LEVELS[index];
    const lvl = this.currentLevel;

    // Set up graph
    this.graph.clear();
    this.graph.nextId = 0;
    const nodeMap = {};

    lvl.preset.nodes.forEach((nd, i) => {
      const id = this.graph.addNode(nd.x, nd.y, nd.label);
      nodeMap[i] = id;
    });

    lvl.preset.edges.forEach(([f, t]) => {
      this.graph.addEdge(nodeMap[f], nodeMap[t]);
    });

    // Mark target node
    if (lvl.targetNode !== null) {
      const target = this.graph.nodes.find(n => n.id === lvl.targetNode);
      if (target) target.isTarget = true;
    }

    this.actionsLeft = lvl.maxActions;
    this.timeLeft = lvl.timeLimit;
    this.state = 'playing';

    this.graph.mode = 'addEdge';

    // Run initial HITS
    this.runHITS();

    // Start timer
    this._startTimer();

    // Wire graph events
    this.graph.onGraphChange = (type, data) => {
      if (this.state !== 'playing') return;
      if (type === 'addEdge' || type === 'addNode') {
        this.actionsLeft--;
        this.onActionUsed && this.onActionUsed(this.actionsLeft);
        this.runHITS();
        this.checkWinCondition();
        if (this.actionsLeft <= 0) {
          // Delay to show final state
          setTimeout(() => this.checkWinCondition(true), 600);
        }
      }
    };
  }

  loadSandbox() {
    this.graph.clear();
    this.graph.nextId = 0;
    this.state = 'sandbox';
    this.currentLevel = null;
    this.graph.mode = 'select';
    this.runHITS();
    this.graph.onGraphChange = () => {
      this.runHITS();
    };
  }

  runHITS() {
    const n = this.graph.nodes.length;
    if (n === 0) return;

    // Build edge list using actual node ids
    const idToIdx = {};
    this.graph.nodes.forEach((node, i) => { idToIdx[node.id] = i; });
    const edges = this.graph.edges
      .filter(e => idToIdx[e.from] !== undefined && idToIdx[e.to] !== undefined)
      .map(e => [idToIdx[e.from], idToIdx[e.to]]);

    const result = HITSAlgorithm.run(n, edges, 100, 1e-6);
    this.lastHITS = result;

    // Map scores back to nodes
    this.graph.nodes.forEach((node, i) => {
      node.hub = result.hubs[i] ?? 0;
      node.authority = result.authorities[i] ?? 0;
    });

    this.onHITSUpdate && this.onHITSUpdate(result);
  }

  checkWinCondition(forced = false) {
    const lvl = this.currentLevel;
    if (!lvl || this.state !== 'playing') return;

    let won = false;

    if (lvl.targetType === 'authority') {
      const target = this.graph.nodes.find(n => n.id === lvl.targetNode);
      if (target && target.authority >= lvl.targetScore) won = true;
    } else if (lvl.targetType === 'hub') {
      const target = this.graph.nodes.find(n => n.id === lvl.targetNode);
      if (target && target.hub >= lvl.targetScore) won = true;
    } else if (lvl.targetType === 'authority_rank') {
      const target = this.graph.nodes.find(n => n.id === lvl.targetNode);
      if (target) {
        const maxAuth = Math.max(...this.graph.nodes.map(n => n.authority));
        if (target.authority === maxAuth && target.authority > 0.01) won = true;
      }
    } else if (lvl.targetType === 'multi_authority') {
      const count = this.graph.nodes.filter(n => n.authority >= lvl.targetScore).length;
      if (count >= lvl.targetCount) won = true;
    }

    if (won) {
      this._stopTimer();
      this.state = 'win';
      const bonus = Math.floor(this.timeLeft * 10 + this.actionsLeft * 50);
      this.score = 1000 + bonus;
      this.totalScore += this.score;
      // Unlock next level
      if (this.levelIndex + 1 < LEVELS.length) {
        this.unlockedLevels.push(this.levelIndex + 1);
      }
      this.onWin && this.onWin({ score: this.score, timeLeft: this.timeLeft, actionsLeft: this.actionsLeft });
      return;
    }

    if (forced && !won) {
      this._stopTimer();
      this.state = 'lose';
      this.onLose && this.onLose({ reason: 'actions' });
    }
  }

  _startTimer() {
    this._stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.state !== 'playing') { this._stopTimer(); return; }
      this.timeLeft--;
      this.onTick && this.onTick(this.timeLeft);
      if (this.timeLeft <= 0) {
        this._stopTimer();
        this.state = 'lose';
        this.onLose && this.onLose({ reason: 'timeout' });
      }
    }, 1000);
  }

  _stopTimer() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  pause() {
    if (this.state === 'playing') { this.state = 'paused'; this._stopTimer(); }
    else if (this.state === 'paused') { this.state = 'playing'; this._startTimer(); }
  }

  reset() {
    this._stopTimer();
    if (this.currentLevel) this.loadLevel(this.levelIndex);
    else this.loadSandbox();
  }

  getLevels() { return LEVELS; }
}
