/**
 * HITS Algorithm Implementation
 * Hyperlink-Induced Topic Search (Kleinberg, 1999)
 *
 * Course: Analysis of Algorithms
 * Purpose: Core algorithm module — pure functions, no UI dependencies
 */

class HITSAlgorithm {
  /**
   * Run HITS on a directed graph
   * @param {number} nodeCount - Number of nodes
   * @param {Array<[number,number]>} edges - Array of [from, to] directed edges
   * @param {number} maxIterations - Max convergence iterations (default: 100)
   * @param {number} epsilon - Convergence threshold (default: 1e-6)
   * @returns {{ hubs: Float64Array, authorities: Float64Array, iterations: number, history: Array }}
   */
  static run(nodeCount, edges, maxIterations = 100, epsilon = 1e-6) {
    const n = nodeCount;

    // Step 1: Initialize all hub and authority scores to 1
    let hubs = new Float64Array(n).fill(1);
    let authorities = new Float64Array(n).fill(1);

    // Precompute adjacency lists for efficiency — O(E) preprocessing
    const outEdges = Array.from({ length: n }, () => []); // outEdges[u] = [v, ...]
    const inEdges  = Array.from({ length: n }, () => []); // inEdges[v]  = [u, ...]

    for (const [from, to] of edges) {
      if (from !== to) { // ignore self-loops
        outEdges[from].push(to);
        inEdges[to].push(from);
      }
    }

    const history = []; // track score evolution for visualization

    let iter = 0;
    for (; iter < maxIterations; iter++) {
      const newAuth = new Float64Array(n);
      const newHub  = new Float64Array(n);

      // Step 2: Authority Update — auth(v) = sum of hub(u) for all u pointing to v
      for (let v = 0; v < n; v++) {
        for (const u of inEdges[v]) {
          newAuth[v] += hubs[u];
        }
      }

      // Step 3: Hub Update — hub(u) = sum of auth(v) for all v that u points to
      for (let u = 0; u < n; u++) {
        for (const v of outEdges[u]) {
          newHub[u] += newAuth[v];
        }
      }

      // Step 4: Normalize both vectors (L2 norm)
      HITSAlgorithm._normalize(newAuth);
      HITSAlgorithm._normalize(newHub);

      // Step 5: Check for convergence
      const authDelta = HITSAlgorithm._delta(authorities, newAuth);
      const hubDelta  = HITSAlgorithm._delta(hubs, newHub);

      // Save snapshot for visualization
      history.push({
        iteration: iter + 1,
        hubs: Array.from(newHub),
        authorities: Array.from(newAuth),
        authDelta,
        hubDelta
      });

      authorities = newAuth;
      hubs = newHub;

      if (authDelta < epsilon && hubDelta < epsilon) {
        iter++;
        break;
      }
    }

    return {
      hubs: Array.from(hubs),
      authorities: Array.from(authorities),
      iterations: iter,
      history,
      outEdges,
      inEdges
    };
  }

  /**
   * Normalize a vector in-place using L2 norm
   * @param {Float64Array} vec
   */
  static _normalize(vec) {
    let norm = 0;
    for (const v of vec) norm += v * v;
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    }
  }

  /**
   * Compute max absolute difference between two vectors (convergence check)
   * @param {Float64Array} a
   * @param {Float64Array} b
   * @returns {number}
   */
  static _delta(a, b) {
    let max = 0;
    for (let i = 0; i < a.length; i++) {
      max = Math.max(max, Math.abs(a[i] - b[i]));
    }
    return max;
  }

  /**
   * Rank nodes by a given score array, descending
   * @param {number[]} scores
   * @returns {Array<{node: number, score: number, rank: number}>}
   */
  static rank(scores) {
    return scores
      .map((score, node) => ({ node, score }))
      .sort((a, b) => b.score - a.score)
      .map((item, i) => ({ ...item, rank: i + 1 }));
  }

  /**
   * Compute a single step (for step-by-step visualization)
   * @param {number} n
   * @param {number[]} hubs
   * @param {number[]} authorities
   * @param {Array} inEdges
   * @param {Array} outEdges
   * @returns {{ hubs, authorities }}
   */
  static step(n, hubs, authorities, inEdges, outEdges) {
    const newAuth = new Float64Array(n);
    const newHub  = new Float64Array(n);

    for (let v = 0; v < n; v++) {
      for (const u of inEdges[v]) newAuth[v] += hubs[u];
    }
    for (let u = 0; u < n; u++) {
      for (const v of outEdges[u]) newHub[u] += newAuth[v];
    }

    HITSAlgorithm._normalize(newAuth);
    HITSAlgorithm._normalize(newHub);

    return {
      hubs: Array.from(newHub),
      authorities: Array.from(newAuth)
    };
  }
}

// Export for module use
if (typeof module !== 'undefined') module.exports = HITSAlgorithm;
