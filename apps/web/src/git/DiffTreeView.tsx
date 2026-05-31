import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  GitCompareIcon,
  Loader2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DiffTree, DiffTreeNode, DiffTreeNodeType } from "@t3tools/contracts";

import { cn } from "~/lib/utils";

type PathTreeDirectory = {
  readonly kind: "directory";
  readonly name: string;
  readonly path: string;
  readonly children: Map<string, PathTreeDirectory | PathTreeFile>;
};

type PathTreeFile = {
  readonly kind: "file";
  readonly name: string;
  readonly path: string;
  readonly node: DiffTreeNode;
};

type PathTreeEntry = PathTreeDirectory | PathTreeFile;

const typeLabel: Record<DiffTreeNodeType, string> = {
  added: "Added",
  modified: "Modified",
  deleted: "Deleted",
  renamed: "Renamed",
};

const typeClassName: Record<DiffTreeNodeType, string> = {
  added: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  modified: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  deleted: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  renamed: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function makeDirectory(name: string, path: string): PathTreeDirectory {
  return {
    kind: "directory",
    name,
    path,
    children: new Map(),
  };
}

function buildTree(nodes: ReadonlyArray<DiffTreeNode>): PathTreeDirectory {
  const root = makeDirectory("", "");
  for (const node of nodes) {
    const parts = node.path.split("/").filter(Boolean);
    let current = root;
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index] ?? "";
      const path = parts.slice(0, index + 1).join("/");
      const isFile = index === parts.length - 1;
      if (isFile) {
        current.children.set(path, {
          kind: "file",
          name: part,
          path,
          node,
        });
        continue;
      }
      const existing = current.children.get(path);
      if (existing?.kind === "directory") {
        current = existing;
        continue;
      }
      const directory = makeDirectory(part, path);
      current.children.set(path, directory);
      current = directory;
    }
  }
  return root;
}

function collectDirectoryPaths(directory: PathTreeDirectory): ReadonlySet<string> {
  const paths = new Set<string>();
  for (const child of directory.children.values()) {
    if (child.kind !== "directory") continue;
    paths.add(child.path);
    for (const nested of collectDirectoryPaths(child)) {
      paths.add(nested);
    }
  }
  return paths;
}

function sortedChildren(directory: PathTreeDirectory): ReadonlyArray<PathTreeEntry> {
  return Array.from(directory.children.values()).toSorted((left, right) => {
    if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

function DiffTreeEntry({
  entry,
  depth,
  expanded,
  toggleExpanded,
}: {
  readonly entry: PathTreeEntry;
  readonly depth: number;
  readonly expanded: ReadonlySet<string>;
  readonly toggleExpanded: (path: string) => void;
}) {
  const isExpanded = expanded.has(entry.path);
  const paddingLeft = 6 + depth * 12;

  if (entry.kind === "directory") {
    return (
      <div>
        <button
          type="button"
          onClick={() => toggleExpanded(entry.path)}
          className="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md pr-2 text-left text-[11px] text-muted-foreground/75 hover:bg-accent/45 hover:text-foreground"
          style={{ paddingLeft }}
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground/45" />
          ) : (
            <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground/45" />
          )}
          <FolderIcon className="size-3 shrink-0 text-muted-foreground/55" />
          <span className="truncate">{entry.name}</span>
        </button>
        {isExpanded
          ? sortedChildren(entry).map((child) => (
              <DiffTreeEntry
                key={child.path}
                entry={child}
                depth={depth + 1}
                expanded={expanded}
                toggleExpanded={toggleExpanded}
              />
            ))
          : null}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => toggleExpanded(entry.path)}
        className="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md pr-2 text-left hover:bg-accent/45"
        style={{ paddingLeft }}
        aria-expanded={isExpanded}
      >
        {entry.node.hunks > 0 ? (
          isExpanded ? (
            <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground/45" />
          ) : (
            <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground/45" />
          )
        ) : (
          <span className="size-3 shrink-0" />
        )}
        <FileIcon className="size-3 shrink-0 text-muted-foreground/50" />
        <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/80">{entry.name}</span>
        <span
          className={cn(
            "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium",
            typeClassName[entry.node.type],
          )}
        >
          {typeLabel[entry.node.type]}
        </span>
        <span className="shrink-0 text-[10px] text-emerald-500">+{entry.node.insertions}</span>
        <span className="shrink-0 text-[10px] text-red-500">-{entry.node.deletions}</span>
      </button>
      {isExpanded && entry.node.hunks > 0 ? (
        <div className="pb-1" style={{ paddingLeft: paddingLeft + 30 }}>
          {Array.from({ length: entry.node.hunks }, (_, index) => (
            <div
              key={`${entry.path}:hunk:${index}`}
              className="flex h-5 items-center gap-1.5 text-[10px] text-muted-foreground/55"
            >
              <GitCompareIcon className="size-3 shrink-0" />
              <span>Hunk {index + 1}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DiffTreeView({
  diffTree,
  isLoading = false,
  error = null,
  compact = false,
}: {
  readonly diffTree: DiffTree | null;
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly compact?: boolean;
}) {
  const tree = useMemo(() => buildTree(diffTree?.nodes ?? []), [diffTree?.nodes]);
  const defaultExpanded = useMemo(() => collectDirectoryPaths(tree), [tree]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => defaultExpanded);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const toggleExpanded = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  if (isLoading && !diffTree) {
    return (
      <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground/55">
        <Loader2Icon className="size-3 animate-spin" />
        Loading diff tree...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
        {error}
      </div>
    );
  }

  if (!diffTree || diffTree.nodes.length === 0) {
    return (
      <div className="rounded-md border border-border/40 bg-background/40 px-2 py-2 text-[11px] text-muted-foreground/60">
        No file changes.
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", compact && "text-[11px]")}>
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-md border border-border/40 bg-background/45 px-2 py-1.5">
          <div className="text-[9px] uppercase text-muted-foreground/50">Files</div>
          <div className="text-[12px] font-medium">{diffTree.summary.totalFiles}</div>
        </div>
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5">
          <div className="text-[9px] uppercase text-emerald-600/70 dark:text-emerald-400/70">
            Added
          </div>
          <div className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
            +{diffTree.summary.totalInsertions}
          </div>
        </div>
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1.5">
          <div className="text-[9px] uppercase text-red-600/70 dark:text-red-400/70">Deleted</div>
          <div className="text-[12px] font-medium text-red-600 dark:text-red-400">
            -{diffTree.summary.totalDeletions}
          </div>
        </div>
      </div>
      <div className="rounded-md border border-border/40 bg-background/35 py-1">
        {sortedChildren(tree).map((entry) => (
          <DiffTreeEntry
            key={entry.path}
            entry={entry}
            depth={0}
            expanded={expanded}
            toggleExpanded={toggleExpanded}
          />
        ))}
      </div>
    </div>
  );
}
