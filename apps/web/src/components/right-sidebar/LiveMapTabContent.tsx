/**
 * LiveMapTabContent — Obsidian-style codebase visualization.
 *
 * Files are glowing nodes, imports are curved edges. Node size reflects
 * line count. Color reflects file type and health. Active files pulse
 * with a green glow when Claude is working on them.
 */
import { useState, useCallback, useEffect, useRef, memo } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./live-map.css";
import { RefreshCwIcon, Loader2Icon, FileIcon, AlertTriangleIcon, GitBranchIcon } from "lucide-react";
import type { ProjectId } from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import { Button } from "~/components/ui/button";
import {
  buildDependencyGraph,
  type DependencyGraph,
  type PathAliases,
} from "~/lib/dependencyGraph";
import { buildNerveGraph, type NerveGraph } from "~/lib/nerveMap";

// ── Color palette ──────────────────────────────────────────────────

const FILE_COLORS: Record<string, { bg: string; glow: string; ring: string }> = {
  ".tsx": { bg: "#3b82f6", glow: "rgba(59,130,246,0.4)", ring: "rgba(59,130,246,0.6)" },
  ".ts": { bg: "#6366f1", glow: "rgba(99,102,241,0.4)", ring: "rgba(99,102,241,0.6)" },
  ".jsx": { bg: "#06b6d4", glow: "rgba(6,182,212,0.4)", ring: "rgba(6,182,212,0.6)" },
  ".js": { bg: "#eab308", glow: "rgba(234,179,8,0.3)", ring: "rgba(234,179,8,0.5)" },
  ".css": { bg: "#ec4899", glow: "rgba(236,72,153,0.4)", ring: "rgba(236,72,153,0.6)" },
  ".scss": { bg: "#ec4899", glow: "rgba(236,72,153,0.4)", ring: "rgba(236,72,153,0.6)" },
  ".json": { bg: "#8b5cf6", glow: "rgba(139,92,246,0.3)", ring: "rgba(139,92,246,0.5)" },
  ".md": { bg: "#10b981", glow: "rgba(16,185,129,0.3)", ring: "rgba(16,185,129,0.5)" },
  default: { bg: "#64748b", glow: "rgba(100,116,139,0.3)", ring: "rgba(100,116,139,0.5)" },
};

const HEALTH_COLORS: Record<string, { bg: string; glow: string; ring: string }> = {
  critical: { bg: "#ef4444", glow: "rgba(239,68,68,0.5)", ring: "rgba(239,68,68,0.7)" },
  warning: { bg: "#f59e0b", glow: "rgba(245,158,11,0.4)", ring: "rgba(245,158,11,0.6)" },
  healthy: { bg: "#22c55e", glow: "rgba(34,197,94,0.3)", ring: "rgba(34,197,94,0.5)" },
};

const ACTIVE_GLOW = { glow: "rgba(34,197,94,0.6)", ring: "rgba(34,197,94,0.8)" };

function getColors(ext: string, healthScore?: number) {
  if (healthScore !== undefined) {
    if (healthScore < 40) return HEALTH_COLORS.critical!;
    if (healthScore < 70) return HEALTH_COLORS.warning!;
  }
  return FILE_COLORS[ext] ?? FILE_COLORS.default!;
}

function getNodeRadius(lineCount: number): number {
  if (lineCount < 30) return 8;
  if (lineCount < 80) return 11;
  if (lineCount < 150) return 14;
  if (lineCount < 300) return 18;
  if (lineCount < 500) return 22;
  return 26;
}

// ── Custom node component ──────────────────────────────────────────

interface FileNodeData {
  label: string;
  extension: string;
  lineCount: number;
  directory: string;
  healthScore?: number;
  isActive?: boolean;
  [key: string]: unknown;
}

const FileNode = memo(function FileNode({ data }: NodeProps<Node<FileNodeData>>) {
  const radius = getNodeRadius(data.lineCount);
  const colors = getColors(data.extension, data.healthScore);
  const isActive = data.isActive === true;
  const size = radius * 2;

  const glowColor = isActive ? ACTIVE_GLOW.glow : colors.glow;
  const ringColor = isActive ? ACTIVE_GLOW.ring : colors.ring;

  return (
    <div
      style={{ width: size, height: size }}
      className="relative group"
      title={`${data.label} (${data.lineCount} lines)\n${data.directory}`}
    >
      {/* Outer glow */}
      <div
        className={isActive ? "live-map-node-pulse" : ""}
        style={{
          position: "absolute",
          inset: -4,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          opacity: isActive ? 1 : 0.6,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Node body */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%, ${colors.bg}dd, ${colors.bg}88)`,
          border: `1.5px solid ${ringColor}`,
          boxShadow: `0 0 ${isActive ? 16 : 8}px ${glowColor}, inset 0 0 ${radius}px rgba(255,255,255,0.1)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "box-shadow 0.3s ease, transform 0.2s ease",
          cursor: "pointer",
        }}
        className="group-hover:scale-110"
      />

      {/* Label on hover */}
      <div
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          top: size + 4,
          left: "50%",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          fontSize: "9px",
          fontWeight: 500,
          color: "rgba(255,255,255,0.85)",
          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
          background: "rgba(0,0,0,0.6)",
          padding: "1px 5px",
          borderRadius: "3px",
          zIndex: 10,
        }}
      >
        {data.label}
        <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 4, fontSize: "8px" }}>
          {data.lineCount}L
        </span>
      </div>

      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 0, height: 0 }} />
    </div>
  );
});

const nodeTypes = { file: FileNode };

// ── Force layout ───────────────────────────────────────────────────

function applyForceLayout(
  graph: DependencyGraph,
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (graph.nodes.length === 0) return positions;

  const connCount = new Map<string, number>();
  for (const edge of graph.edges) {
    connCount.set(edge.source, (connCount.get(edge.source) ?? 0) + 1);
    connCount.set(edge.target, (connCount.get(edge.target) ?? 0) + 1);
  }

  // Node radii for collision detection
  const nodeRadii = new Map<string, number>();
  for (const node of graph.nodes) {
    nodeRadii.set(node.id, getNodeRadius(node.lineCount) + 6); // padding
  }

  // Group by directory for initial clustering
  const dirGroups = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const dir = node.directory;
    if (!dirGroups.has(dir)) dirGroups.set(dir, []);
    dirGroups.get(dir)!.push(node.id);
  }

  // Initialize with directory-clustered positions + jitter
  const layoutNodes = graph.nodes.map((node) => {
    const dir = node.directory;
    const dirList = dirGroups.get(dir)!;
    const dirIndex = [...dirGroups.keys()].indexOf(dir);
    const nodeIndex = dirList.indexOf(node.id);
    const dirAngle = (2 * Math.PI * dirIndex) / Math.max(dirGroups.size, 1);
    const clusterRadius = Math.min(width, height) * 0.28;
    const nodeAngle = (2 * Math.PI * nodeIndex) / Math.max(dirList.length, 1);
    const spread = Math.min(80, 25 + dirList.length * 6);
    // Small jitter to break symmetry
    const jx = (Math.random() - 0.5) * 10;
    const jy = (Math.random() - 0.5) * 10;

    return {
      id: node.id,
      x: width / 2 + clusterRadius * Math.cos(dirAngle) + spread * Math.cos(nodeAngle) + jx,
      y: height / 2 + clusterRadius * Math.sin(dirAngle) + spread * Math.sin(nodeAngle) + jy,
      vx: 0,
      vy: 0,
      connections: connCount.get(node.id) ?? 0,
    };
  });

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  // 120 iterations with cooling schedule
  const iterations = 120;
  for (let iter = 0; iter < iterations; iter++) {
    const t = iter / iterations;
    const alpha = Math.max(0.001, (1 - t) * (1 - t)); // Quadratic decay

    // 1. Charge repulsion (Barnes-Hut approximation not needed for <1000 nodes)
    for (let i = 0; i < layoutNodes.length; i++) {
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const a = layoutNodes[i]!;
        const b = layoutNodes[j]!;
        const dx = b.x - a.x || 0.01;
        const dy = b.y - a.y || 0.01;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        // Stronger repulsion for close nodes, falls off with distance squared
        const charge = -400 * alpha;
        const force = charge / Math.max(distSq, 25);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // 2. Link attraction (spring force)
    for (const edge of graph.edges) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const targetDist = 70;
      const strength = (dist - targetDist) * 0.02 * alpha;
      const fx = (dx / dist) * strength;
      const fy = (dy / dist) * strength;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // 3. Center gravity (gentle pull toward center)
    const cx = width / 2;
    const cy = height / 2;
    for (const node of layoutNodes) {
      node.vx += (cx - node.x) * 0.005 * alpha;
      node.vy += (cy - node.y) * 0.005 * alpha;
    }

    // 4. Collision detection — prevent overlapping nodes
    for (let i = 0; i < layoutNodes.length; i++) {
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const a = layoutNodes[i]!;
        const b = layoutNodes[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = (nodeRadii.get(a.id) ?? 15) + (nodeRadii.get(b.id) ?? 15);

        if (dist < minDist && dist > 0) {
          const overlap = (minDist - dist) / dist * 0.5;
          const ox = dx * overlap;
          const oy = dy * overlap;
          a.x -= ox;
          a.y -= oy;
          b.x += ox;
          b.y += oy;
        }
      }
    }

    // 5. Velocity damping + position update
    const damping = 0.88 - t * 0.1; // Increases damping over time
    for (const node of layoutNodes) {
      node.vx *= damping;
      node.vy *= damping;
      // Clamp velocity to prevent instability
      const maxV = 20 * (1 - t);
      node.vx = Math.max(-maxV, Math.min(maxV, node.vx));
      node.vy = Math.max(-maxV, Math.min(maxV, node.vy));
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  for (const node of layoutNodes) {
    positions.set(node.id, { x: node.x, y: node.y });
  }
  return positions;
}

// ── Main component ─────────────────────────────────────────────────

export function LiveMapTabContent({
  projectId,
  projectCwd,
}: {
  projectId: ProjectId;
  projectCwd?: string | undefined;
}) {
  const threads = useStore((store) => store.threads);
  const [viewMode, setViewMode] = useState<"files" | "functions">("files");
  const [highlightFeature, setHighlightFeature] = useState<string | null>(null);
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [nerveGraph, setNerveGraph] = useState<NerveGraph | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFiles, setActiveFiles] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<FileNodeData | null>(null);

  // Track active files from running threads
  useEffect(() => {
    const projectThreads = threads.filter((t) => t.projectId === projectId);
    const active = new Set<string>();
    for (const thread of projectThreads) {
      const latestDiff = thread.turnDiffSummaries.slice(-1)[0];
      if (!latestDiff?.files) continue;
      const isRunning = thread.session?.status === "running";
      const isRecent = Date.now() - new Date(latestDiff.completedAt).getTime() < 60_000;
      if (isRunning || isRecent) {
        for (const file of latestDiff.files) {
          if (file.path) active.add(file.path);
        }
      }
    }
    setActiveFiles(active);
  }, [threads, projectId]);

  // Update isActive on nodes and edge styles when activeFiles changes
  useEffect(() => {
    if (nodes.length === 0) return;
    setNodes((prev) =>
      prev.map((node) => {
        const shouldBeActive = activeFiles.has(node.id);
        const currentlyActive = (node.data as FileNodeData).isActive === true;
        if (shouldBeActive === currentlyActive) return node;
        return {
          ...node,
          data: { ...node.data, isActive: shouldBeActive },
        };
      }),
    );
    // Also update edge styles for active connections
    if (activeFiles.size > 0) {
      setEdges((prev) =>
        prev.map((edge) => {
          const isActive = activeFiles.has(edge.source) || activeFiles.has(edge.target);
          return {
            ...edge,
            style: isActive
              ? { stroke: "rgba(34,197,94,0.4)", strokeWidth: 2 }
              : { stroke: "rgba(148,163,184,0.12)", strokeWidth: 1 },
            animated: isActive,
          };
        }),
      );
    }
  }, [activeFiles, nodes.length, setNodes, setEdges]);

  const loadGraph = useCallback(async () => {
    if (!projectCwd) return;
    setIsLoading(true);
    setError(null);

    try {
      const api = readNativeApi();
      if (!api) return;

      const scanResult = await api.projects.listSourceFiles({
        cwd: projectCwd,
        maxFiles: 500,
      });
      const files = scanResult.files.map((f: any) => ({
        relativePath: f.relativePath,
        content: f.content,
        sizeBytes: f.sizeBytes,
      }));

      if (files.length === 0) {
        setError("No source files found in this project.");
        setIsLoading(false);
        return;
      }

      const aliases: PathAliases = { "~/": "src/" };
      const depGraph = buildDependencyGraph(files, aliases);
      setGraph(depGraph);

      // Also build nerve graph for function-level view
      const nerve = buildNerveGraph(files);
      setNerveGraph(nerve);

      // Connection counts for health
      const connectionCounts = new Map<string, number>();
      for (const edge of depGraph.edges) {
        connectionCounts.set(edge.source, (connectionCounts.get(edge.source) ?? 0) + 1);
        connectionCounts.set(edge.target, (connectionCounts.get(edge.target) ?? 0) + 1);
      }

      // Update + fetch health (non-blocking)
      let healthByFile = new Map<string, number>();
      try {
        await api.codebaseHealth.updateHealth({
          projectId,
          files: depGraph.nodes.map((n) => ({
            filePath: n.id,
            lineCount: n.lineCount,
            connectionCount: connectionCounts.get(n.id) ?? 0,
          })),
        });
        const healthResult = await api.codebaseHealth.getSummary({ projectId });
        for (const f of [
          ...healthResult.summary.criticalFiles,
          ...healthResult.summary.warningFiles,
        ]) {
          healthByFile.set(f.filePath, f.healthScore);
        }
      } catch {
        // Non-critical
      }

      // Layout
      const w = containerRef.current?.clientWidth ?? 800;
      const h = containerRef.current?.clientHeight ?? 600;
      const positions = applyForceLayout(depGraph, w, h);

      // Build React Flow nodes with custom type
      const rfNodes: Node[] = depGraph.nodes.map((node) => {
        const pos = positions.get(node.id) ?? { x: 0, y: 0 };
        const radius = getNodeRadius(node.lineCount);

        return {
          id: node.id,
          type: "file",
          position: { x: pos.x - radius, y: pos.y - radius },
          data: {
            label: node.name,
            lineCount: node.lineCount,
            directory: node.directory,
            extension: node.extension,
            ...(healthByFile.has(node.id) ? { healthScore: healthByFile.get(node.id) } : {}),
            isActive: false, // Updated by the activeFiles useEffect
          } as FileNodeData,
        };
      });

      // Build edges — all start as inactive; active state updated by useEffect
      const rfEdges: Edge[] = depGraph.edges.map((edge, i) => ({
        id: `e-${i}`,
        source: edge.source,
        target: edge.target,
        type: "default",
        style: { stroke: "rgba(148,163,184,0.12)", strokeWidth: 1 },
        animated: false,
      }));

      // Build nerve graph with force layout
      const nerveForGraph: DependencyGraph = {
        nodes: nerve.functions.map((func) => ({
          id: func.id,
          name: func.name,
          directory: func.filePath,
          extension: func.type === "component" ? ".tsx" : func.type === "hook" ? ".tsx" : ".ts",
          lineCount: func.lineCount,
          sizeBytes: func.lineCount * 40,
        })),
        edges: nerve.calls,
        stats: {
          totalFiles: nerve.functions.length,
          totalEdges: nerve.calls.length,
          avgConnectionsPerFile: nerve.calls.length / Math.max(nerve.functions.length, 1),
          largestFile: null,
          isolatedFiles: 0,
        },
      };
      const nervePositions = applyForceLayout(nerveForGraph, w, h);

      const nerveNodes: Node[] = nerve.functions.map((func) => {
        const pos = nervePositions.get(func.id) ?? { x: w / 2, y: h / 2 };
        const radius = func.type === "component" ? 14 : func.type === "hook" ? 12 : 9;
        const typeExt = func.type === "component" ? ".tsx" : func.type === "hook" ? ".tsx" : func.type === "class" ? ".json" : ".ts";

        return {
          id: func.id,
          type: "file",
          position: { x: pos.x - radius, y: pos.y - radius },
          data: {
            label: func.name,
            lineCount: func.lineCount,
            directory: func.filePath,
            extension: typeExt,
            isActive: false,
          } as FileNodeData,
        };
      });

      const nerveCalls: Edge[] = nerve.calls.map((call, i) => ({
        id: `ne-${i}`,
        source: call.source,
        target: call.target,
        type: "default",
        style: { stroke: "rgba(148,163,184,0.15)", strokeWidth: 1 },
        animated: false,
      }));

      // Set nodes/edges based on current view mode
      if (viewMode === "functions" && nerveNodes.length > 0) {
        setNodes(nerveNodes);
        setEdges(nerveCalls);
      } else {
        setNodes(rfNodes);
        setEdges(rfEdges);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load codebase graph");
    } finally {
      setIsLoading(false);
    }
  // Note: activeFiles intentionally NOT in deps — node highlighting is handled
  // by the separate useEffect that updates isActive on nodes. Including activeFiles
  // here would cause the entire graph to re-scan and re-layout on every store update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCwd, projectId, viewMode, setNodes, setEdges]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  // Note: viewMode is in loadGraph's closure via the dependency on it changing,
  // so switching modes triggers a reload. This is intentional for now.

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground/80">
            {viewMode === "files" ? "File Map" : "Nerve Map"}
          </span>
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "files" ? "functions" : "files")}
            className="text-[9px] text-muted-foreground/50 hover:text-foreground/70 px-1.5 py-0.5 rounded border border-border/30 hover:border-border/60 transition-colors"
            title={viewMode === "files" ? "Switch to function view" : "Switch to file view"}
          >
            <GitBranchIcon className="size-2.5 inline mr-0.5" />
            {viewMode === "files" ? "Functions" : "Files"}
          </button>
        </div>
        <Button
          size="xs"
          variant="ghost"
          className="h-5"
          onClick={() => void loadGraph()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-3" />
          )}
        </Button>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 live-map-bg relative">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center gap-2">
            <AlertTriangleIcon className="size-5 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/60">{error}</p>
            <Button size="xs" variant="outline" onClick={() => void loadGraph()}>
              Retry
            </Button>
          </div>
        ) : nodes.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center gap-2">
            <FileIcon className="size-6 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground/60">
              Click refresh to scan the project.
            </p>
          </div>
        ) : (
          <>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_event, node) => {
              setSelectedNode(node.data as FileNodeData);
            }}
            onPaneClick={() => setSelectedNode(null)}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.05}
            maxZoom={4}
            proOptions={{ hideAttribution: true }}
            style={{ background: "transparent" }}
            defaultEdgeOptions={{
              type: "default",
              style: { stroke: "rgba(148,163,184,0.12)", strokeWidth: 1 },
            }}
          >
            <Background color="rgba(148,163,184,0.03)" gap={30} size={1} />
            <MiniMap
              style={{
                background: "rgba(10,10,15,0.9)",
                borderRadius: 6,
                border: "1px solid rgba(148,163,184,0.1)",
              }}
              maskColor="rgba(10,10,15,0.7)"
              nodeColor={(node) => {
                const d = node.data as FileNodeData;
                return getColors(d.extension, d.healthScore).bg;
              }}
              nodeStrokeWidth={0}
              pannable
              zoomable
            />
            <Controls
              showInteractive={false}
              style={{
                background: "rgba(10,10,15,0.8)",
                borderRadius: 6,
                border: "1px solid rgba(148,163,184,0.1)",
              }}
            />
          </ReactFlow>

          {/* Health legend */}
          <div className="live-map-legend">
            <div className="live-map-legend-item">
              <div className="live-map-legend-dot" style={{ background: "#3b82f6" }} />
              <span>.tsx</span>
            </div>
            <div className="live-map-legend-item">
              <div className="live-map-legend-dot" style={{ background: "#6366f1" }} />
              <span>.ts</span>
            </div>
            <div className="live-map-legend-item">
              <div className="live-map-legend-dot" style={{ background: "#ef4444" }} />
              <span>Critical</span>
            </div>
            <div className="live-map-legend-item">
              <div className="live-map-legend-dot" style={{ background: "#f59e0b" }} />
              <span>Warning</span>
            </div>
            <div className="live-map-legend-item">
              <div className="live-map-legend-dot" style={{ background: "#22c55e" }} />
              <span>Active</span>
            </div>
          </div>
          </>
        )}
      </div>

      {/* Selected node detail panel */}
      {selectedNode && (
        <div className="shrink-0 border-t border-border/40 px-3 py-2 bg-card/80 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground/80">{selectedNode.label}</span>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="text-[10px] text-muted-foreground/40 hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="text-[10px] text-muted-foreground/60 space-y-0.5">
            <p>Path: {selectedNode.directory}/{selectedNode.label}</p>
            <p>Lines: {selectedNode.lineCount}</p>
            <p>Type: {selectedNode.extension || "unknown"}</p>
            {selectedNode.healthScore !== undefined && (
              <p className={
                selectedNode.healthScore < 40 ? "text-red-400" :
                selectedNode.healthScore < 70 ? "text-amber-400" :
                "text-emerald-400"
              }>
                Health: {selectedNode.healthScore}/100
              </p>
            )}
            {selectedNode.isActive && (
              <p className="text-emerald-400 font-medium">Currently being edited by AI</p>
            )}
          </div>
        </div>
      )}

      {/* Health summary (if critical/warning files exist) */}
      {graph && (() => {
        const criticalNodes = graph.nodes.filter((n) => n.lineCount > 500);
        const largeNodes = graph.nodes.filter((n) => n.lineCount > 300 && n.lineCount <= 500);
        if (criticalNodes.length === 0 && largeNodes.length === 0) return null;
        return (
          <div className="shrink-0 border-t border-border/40 px-3 py-1.5" style={{ background: "rgba(10,10,15,0.5)" }}>
            {criticalNodes.length > 0 && (
              <p className="text-[9px] text-red-400/70">
                {criticalNodes.length} file{criticalNodes.length !== 1 ? "s" : ""} over 500 lines — consider splitting
              </p>
            )}
            {largeNodes.length > 0 && (
              <p className="text-[9px] text-amber-400/70">
                {largeNodes.length} file{largeNodes.length !== 1 ? "s" : ""} over 300 lines — watch for growth
              </p>
            )}
          </div>
        );
      })()}

      {/* Stats bar */}
      {(graph || nerveGraph) && (
        <div
          className="shrink-0 border-t border-border/40 px-3 py-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/50"
          style={{ background: "rgba(10,10,15,0.5)" }}
        >
          {viewMode === "files" && graph && (
            <>
              <span>{graph.stats.totalFiles} files</span>
              <span>{graph.stats.totalEdges} imports</span>
              {graph.stats.largestFile && (
                <span className={graph.stats.largestFile.lines > 500 ? "text-red-400/70" : ""}>
                  largest: {graph.stats.largestFile.lines}L
                </span>
              )}
              {graph.stats.isolatedFiles > 0 && (
                <span className="text-amber-400/70">{graph.stats.isolatedFiles} isolated</span>
              )}
            </>
          )}
          {viewMode === "functions" && nerveGraph && (
            <>
              <span>{nerveGraph.stats.totalFunctions} functions</span>
              <span>{nerveGraph.stats.totalCalls} calls</span>
              {nerveGraph.stats.unusedFunctions > 0 && (
                <span className="text-amber-400/70">{nerveGraph.stats.unusedFunctions} unused</span>
              )}
              {nerveGraph.stats.hotFunctions > 0 && (
                <span className="text-red-400/70">{nerveGraph.stats.hotFunctions} hot</span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
