# 🌐 WebRank Wars — HITS Algorithm Game

A browser-based game that teaches and demonstrates the **HITS (Hyperlink-Induced Topic Search)** algorithm through interactive gameplay.

## 📚 Course Context

- **Course**: Analysis of Algorithms
- **Algorithm**: HITS (Kleinberg's Algorithm, 1999)
- **Concept**: Hub & Authority scoring on directed graphs

## 🎮 Game Overview

Players act as **Web Architects** — building and managing a network of web pages. The HITS algorithm runs in real-time, assigning **Hub** and **Authority** scores to each node. Your goal is to strategically add links to maximize your target node's authority score before time runs out.

## 🧠 How HITS Works

HITS operates on a directed graph and iteratively computes two scores per node:

- **Authority Score**: How much good content a page has (pages linked to by good hubs)
- **Hub Score**: How well a page links to authoritative pages

### Algorithm Steps:
1. Start with all scores = 1
2. **Authority Update**: `auth(v) = Σ hub(u)` for all u → v
3. **Hub Update**: `hub(u) = Σ auth(v)` for all u → v
4. **Normalize** both vectors
5. Repeat until convergence

## 🗂️ Project Structure

```
hits-algorithm-game/
├── index.html          # Main entry point
├── css/
│   └── style.css       # Game styles & animations
├── js/
│   ├── hits.js         # Pure HITS algorithm implementation
│   ├── graph.js        # Graph data structure & rendering
│   ├── game.js         # Game logic, levels, scoring
│   └── ui.js           # UI interactions & animations
├── assets/
│   └── icons/          # SVG icons
└── README.md
```

## 🚀 How to Run

Simply open `index.html` in any modern browser — no server required!

```bash
git clone https://github.com/YOUR_USERNAME/hits-algorithm-game.git
cd hits-algorithm-game
open index.html
```

## 🏆 Game Modes

| Mode | Description |
|------|-------------|
| **Tutorial** | Learn HITS step-by-step with guided play |
| **Campaign** | 5 levels of increasing graph complexity |
| **Sandbox** | Free-build mode — experiment with any graph |

## 📊 Algorithm Complexity

| Operation | Complexity |
|-----------|-----------|
| Per Iteration | O(E) |
| Full Convergence | O(k × E) where k = iterations |
| Space | O(V) |

## 📖 References

- Kleinberg, J. M. (1999). *Authoritative sources in a hyperlinked environment*. Journal of the ACM.
- [Original Paper (PDF)](https://www.cs.cornell.edu/home/kleinber/auth.pdf)
