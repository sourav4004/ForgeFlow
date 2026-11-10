import type { WorkflowGraph } from '@flowforge/contracts';

/**
 * Machine-readable integrity diagnostic codes for workflow graph structural and topological analysis.
 */
export type GraphIntegrityIssueCode =
  | 'DUPLICATE_NODE_ID'
  | 'DUPLICATE_EDGE_ID'
  | 'MISSING_EDGE_SOURCE'
  | 'MISSING_EDGE_TARGET'
  | 'CYCLE_DETECTED';

/**
 * Diagnostic issue describing a structural or topological defect within a workflow graph.
 */
export interface GraphIntegrityIssue {
  readonly code: GraphIntegrityIssueCode;
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

/**
 * Successful graph analysis outcome containing deterministic topological node ordering.
 */
export interface GraphAnalysisSuccessResult {
  readonly success: true;
  readonly issues: [];
  readonly topologicalNodeIds: string[];
}

/**
 * Failed graph analysis outcome containing structural or topological diagnostic issues.
 */
export interface GraphAnalysisFailureResult {
  readonly success: false;
  readonly issues: GraphIntegrityIssue[];
}

/**
 * Discriminated union outcome of workflow graph structural and topological analysis.
 */
export type GraphAnalysisResult = GraphAnalysisSuccessResult | GraphAnalysisFailureResult;

/**
 * Internal zero-dependency binary min-heap for deterministic priority-queue extraction.
 */
class BinaryMinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  pop(): T | undefined {
    if (this.items.length === 0) {
      return undefined;
    }
    const top = this.items[0];
    const bottom = this.items.pop();
    if (this.items.length > 0 && bottom !== undefined) {
      this.items[0] = bottom;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      const currentItem = this.items[current];
      const parentItem = this.items[parent];
      if (
        currentItem !== undefined &&
        parentItem !== undefined &&
        this.compare(currentItem, parentItem) < 0
      ) {
        this.items[current] = parentItem;
        this.items[parent] = currentItem;
        current = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number): void {
    let current = index;
    const length = this.items.length;
    while (true) {
      let smallest = current;
      const left = 2 * current + 1;
      const right = 2 * current + 2;

      const currentItem = this.items[smallest];
      const leftItem = this.items[left];
      const rightItem = this.items[right];

      if (
        left < length &&
        leftItem !== undefined &&
        currentItem !== undefined &&
        this.compare(leftItem, currentItem) < 0
      ) {
        smallest = left;
      }

      const smallestItem = this.items[smallest];
      if (
        right < length &&
        rightItem !== undefined &&
        smallestItem !== undefined &&
        this.compare(rightItem, smallestItem) < 0
      ) {
        smallest = right;
      }

      if (smallest !== current) {
        const temp = this.items[current];
        const swapTarget = this.items[smallest];
        if (temp !== undefined && swapTarget !== undefined) {
          this.items[current] = swapTarget;
          this.items[smallest] = temp;
        }
        current = smallest;
      } else {
        break;
      }
    }
  }
}

/**
 * Deterministic ECMAScript lexicographic string comparison without locale dependencies.
 */
function compareLexicographic(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Pure, deterministic workflow graph analysis function.
 *
 * Staged analysis:
 * - Stage A: Validate node and edge identifier uniqueness.
 * - Stage B: Validate edge referential integrity (sources and targets exist).
 *   If any Stage A or Stage B issues are detected, immediately returns failure with collected diagnostics
 *   and skips topological calculation to prevent misleading cycle diagnoses.
 * - Stage C: Execute deterministic Kahn's topological sorting using a binary min-heap for O((V + E) log V)
 *   tie-breaking by lexicographically smallest node ID.
 *
 * Note: A successful analysis confirms graph acyclicity and edge referential integrity.
 * It does NOT signify publish-readiness, node configuration validity, or execution completeness.
 *
 * @param graph Structurally valid workflow graph definition.
 * @returns Discriminated result indicating success with topological ordering or failure with diagnostics.
 */
export function analyzeWorkflowGraph(graph: WorkflowGraph): GraphAnalysisResult {
  const issues: GraphIntegrityIssue[] = [];

  // Stage A: Validate identifiers
  const seenNodeIds = new Set<string>();
  for (let index = 0; index < graph.nodes.length; index += 1) {
    const node = graph.nodes[index];
    if (node === undefined) continue;

    if (seenNodeIds.has(node.id)) {
      issues.push({
        code: 'DUPLICATE_NODE_ID',
        path: ['nodes', index, 'id'],
        message: `Duplicate node ID "${node.id}" at index ${index}`,
      });
    } else {
      seenNodeIds.add(node.id);
    }
  }

  const allNodeIds = new Set<string>(graph.nodes.map((n) => n.id));

  const seenEdgeIds = new Set<string>();
  for (let index = 0; index < graph.edges.length; index += 1) {
    const edge = graph.edges[index];
    if (edge === undefined) continue;

    if (seenEdgeIds.has(edge.id)) {
      issues.push({
        code: 'DUPLICATE_EDGE_ID',
        path: ['edges', index, 'id'],
        message: `Duplicate edge ID "${edge.id}" at index ${index}`,
      });
    } else {
      seenEdgeIds.add(edge.id);
    }
  }

  // Stage B: Validate edge referential integrity
  for (let index = 0; index < graph.edges.length; index += 1) {
    const edge = graph.edges[index];
    if (edge === undefined) continue;

    if (!allNodeIds.has(edge.source)) {
      issues.push({
        code: 'MISSING_EDGE_SOURCE',
        path: ['edges', index, 'source'],
        message: `Edge "${edge.id}" at index ${index} references non-existent source node "${edge.source}"`,
      });
    }

    if (!allNodeIds.has(edge.target)) {
      issues.push({
        code: 'MISSING_EDGE_TARGET',
        path: ['edges', index, 'target'],
        message: `Edge "${edge.id}" at index ${index} references non-existent target node "${edge.target}"`,
      });
    }
  }

  // If Stage A or Stage B identified issues, return immediately
  if (issues.length > 0) {
    return {
      success: false,
      issues,
    };
  }

  // Stage C: Deterministic Kahn's topological sorting
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of graph.edges) {
    const targets = adjacency.get(edge.source);
    if (targets !== undefined) {
      targets.push(edge.target);
    }
    const currentInDegree = inDegree.get(edge.target);
    if (currentInDegree !== undefined) {
      inDegree.set(edge.target, currentInDegree + 1);
    }
  }

  const minHeap = new BinaryMinHeap<string>(compareLexicographic);

  for (const node of graph.nodes) {
    if (inDegree.get(node.id) === 0) {
      minHeap.push(node.id);
    }
  }

  const topologicalNodeIds: string[] = [];

  while (!minHeap.isEmpty()) {
    const current = minHeap.pop();
    if (current === undefined) break;

    topologicalNodeIds.push(current);

    const neighbors = adjacency.get(current);
    if (neighbors !== undefined) {
      for (const neighbor of neighbors) {
        const nextInDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, nextInDegree);
        if (nextInDegree === 0) {
          minHeap.push(neighbor);
        }
      }
    }
  }

  if (topologicalNodeIds.length < graph.nodes.length) {
    return {
      success: false,
      issues: [
        {
          code: 'CYCLE_DETECTED',
          path: ['edges'],
          message: 'Workflow graph contains one or more directed cycles',
        },
      ],
    };
  }

  return {
    success: true,
    issues: [],
    topologicalNodeIds,
  };
}
