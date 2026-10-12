/**
 * Commit-graph lane layout.
 *
 * Commits must be in topological order, newest first (as produced by
 * `git log --topo-order`). Lanes are never compacted, so a lane that is not
 * involved in a row keeps its column — this keeps the drawing simple and
 * stable while scrolling and when more commits are loaded.
 */

export interface GraphInput {
  hash: string;
  parents: string[];
}

export interface GraphEdge {
  /** Column at the start of the segment. */
  from: number;
  /** Column at the end of the segment. */
  to: number;
  color: number;
}

export interface GraphRow {
  column: number;
  color: number;
  /** Segments from the top of the row to the node's vertical centre. */
  top: GraphEdge[];
  /** Segments from the node's vertical centre to the bottom of the row. */
  bottom: GraphEdge[];
  isMerge: boolean;
}

export interface GraphLayout {
  rows: GraphRow[];
  /** Number of columns needed to draw every row. */
  width: number;
}

export function layoutGraph(commits: GraphInput[]): GraphLayout {
  const lanes: (string | null)[] = [];
  const laneColors: number[] = [];
  let nextColor = 0;
  let width = 0;
  const rows: GraphRow[] = [];

  const allocate = (hash: string): number => {
    let idx = lanes.indexOf(null);
    if (idx === -1) {
      idx = lanes.length;
      lanes.push(null);
      laneColors.push(0);
    }
    lanes[idx] = hash;
    laneColors[idx] = nextColor++;
    return idx;
  };

  for (const commit of commits) {
    const before = lanes.slice();
    const beforeColors = laneColors.slice();

    let column = lanes.indexOf(commit.hash);
    if (column === -1) column = allocate(commit.hash);
    const color = laneColors[column];

    // Top half: lanes arriving at this commit converge on its column;
    // all other active lanes pass straight through.
    const top: GraphEdge[] = [];
    before.forEach((h, j) => {
      if (h === null) return;
      top.push({ from: j, to: h === commit.hash ? column : j, color: beforeColors[j] });
    });

    // Free every lane that was waiting for this commit.
    lanes.forEach((h, j) => {
      if (h === commit.hash) lanes[j] = null;
    });

    // Assign parents to lanes.
    const parentLanes: number[] = [];
    commit.parents.forEach((parent, i) => {
      const existing = lanes.indexOf(parent);
      if (existing !== -1) {
        parentLanes.push(existing);
      } else if (i === 0) {
        lanes[column] = parent;
        laneColors[column] = color;
        parentLanes.push(column);
      } else {
        parentLanes.push(allocate(parent));
      }
    });

    // Bottom half: edges from this node to each parent lane, plus pass-throughs.
    const bottom: GraphEdge[] = [];
    const parentSet = new Set(parentLanes);
    for (const k of parentLanes) bottom.push({ from: column, to: k, color: laneColors[k] });
    lanes.forEach((h, k) => {
      if (h === null || parentSet.has(k)) return;
      bottom.push({ from: k, to: k, color: laneColors[k] });
    });

    // Trim trailing empty lanes so the graph doesn't grow forever.
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop();
      laneColors.pop();
    }

    width = Math.max(width, before.length, column + 1, lanes.length);
    rows.push({ column, color, top, bottom, isMerge: commit.parents.length > 1 });
  }

  return { rows, width };
}

/** A restrained palette that reads well on light and dark backgrounds. */
export const LANE_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#64748b', // slate
  '#ef4444', // red
];

export const laneColor = (i: number): string => LANE_COLORS[i % LANE_COLORS.length];
