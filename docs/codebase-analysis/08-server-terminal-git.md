# Rowl Terminal, Git, and Checkpointing Systems Analysis

_Document version: 1.0_  
_Last updated: April 13, 2026_

---

## Table of Contents

1. [Terminal System](#terminal-system)
2. [Git System](#git-system)
3. [Checkpointing System](#checkpointing-system)
4. [Web Client State Management](#web-client-state-management)
5. [Cross-Cutting Concerns](#cross-cutting-concerns)

---

## Terminal System

### Overview

The terminal system provides pseudo-terminal (PTY) session management for Rowl. It allows spawning interactive shell sessions within threads, with full input/output control, history persistence, and subprocess tracking.

### Architecture

#### Layer Architecture

The terminal system follows a layered architecture with two distinct hierarchies:

**Layers (Business Logic + Effect Integration):**

- `apps/server/src/terminal/Layers/NodePTY.ts` - NodePTY layer using node-pty native addon
- `apps/server/src/terminal/Layers/BunPTY.ts` - BunPTY layer using Bun.spawn
- `apps/server/src/terminal/Layers/Manager.ts` - TerminalManagerRuntime implementing full session lifecycle

**Services (Raw Implementations):**

- `apps/server/src/terminal/Services/PTY.ts` - PtyAdapterShape interface contract
- `apps/server/src/terminal/Services/Manager.ts` - TerminalManagerShape interface contract

#### Key Components

**PtyAdapterShape (Services/PTY.ts):**

```typescript
interface PtyAdapterShape {
  spawn(input: PtySpawnInput): Effect.Effect<PtyProcess, PtySpawnError>;
}

interface PtyProcess {
  readonly pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(callback: (data: string) => void): () => void;
  onExit(callback: (event: PtyExitEvent) => void): () => void;
}
```

**TerminalManagerShape (Services/Manager.ts):**

```typescript
interface TerminalManagerShape {
  open(raw: TerminalOpenInput): Effect.Effect<TerminalSessionSnapshot, TerminalError>;
  write(raw: TerminalWriteInput): Effect.Effect<void, TerminalError>;
  resize(raw: TerminalResizeInput): Effect.Effect<void, TerminalError>;
  clear(raw: TerminalClearInput): Effect.Effect<void, TerminalError>;
  restart(raw: TerminalRestartInput): Effect.Effect<TerminalSessionSnapshot, TerminalError>;
  close(raw: TerminalCloseInput): Effect.Effect<void, TerminalError>;
  subscribe(handler: (event: TerminalEvent) => void): () => void;
  dispose(): Effect.Effect<void, never>;
}

interface TerminalSessionState {
  threadId: string;
  terminalId: string;
  cwd: string;
  launchCommand: string | null;
  launchArgs: string[] | null;
  status: "starting" | "running" | "exited" | "error";
  pid: number | null;
  history: string;
  exitCode: number | null;
  exitSignal: number | null;
  updatedAt: string;
  cols: number;
  rows: number;
  process: PtyProcess | null;
  unsubscribeData: (() => void) | null;
  unsubscribeExit: (() => void) | null;
  hasRunningSubprocess: boolean;
  runtimeEnv: Record<string, string> | null;
}
```

### Data Flow

1. **Session Open**: Client sends `TerminalOpenInput` via WebSocket → `TerminalManagerRuntime.open()` → resolve shell candidates → spawn PTY via adapter → set up data/exit handlers → initialize history
2. **Data Flow**: PTY data → `onData` callback → append to history → debounced persist to filesystem → emit TerminalEvent
3. **Session Close**: Client sends `TerminalCloseInput` → `TerminalManagerRuntime.close()` → stop process → optionally delete history → emit TerminalEvent
4. **History Persistence**: Debounced writes every 40ms to `{logsDir}/terminal/{threadId}/{terminalId}.log`

### Shell Resolution

The system resolves shells in a platform-specific order:

**Windows:**

1. Requested shell (via ComSpec)
2. ComSpec env var
3. powershell.exe
4. cmd.exe

**Unix/Linux:**

1. Requested shell (via SHELL env)
2. SHELL env
3. /bin/zsh
4. /bin/bash
5. /bin/sh
6. zsh (PATH)
7. bash (PATH)
8. sh (PATH)

Special handling for zsh: appends `-o nopromptsp` flag to prevent `%` end markers in prompt output.

### Subprocess Detection

The system polls for child processes of the terminal PID to determine `hasRunningSubprocess`:

**Windows**: Uses PowerShell `Get-CimInstance Win32_Process` with ParentProcessId filter
**POSIX**: Uses `pgrep -P <pid>` with fallback to `ps -eo pid=,ppid=`

Poll interval: 1000ms (configurable)

### Environment Variables

Terminal sessions exclude certain environment variables:

```typescript
const TERMINAL_ENV_BLOCKLIST = new Set(["PORT", "ELECTRON_RENDERER_PORT", "ELECTRON_RUN_AS_NODE"]);

// Also excludes ROWL_* and VITE_* prefixes
```

### History Management

- **Line limit**: 5,000 lines (configurable via `historyLineLimit`)
- **Persist debounce**: 40ms
- **History path**: `{logsDir}/terminal/{threadId}/{terminalId}.log`
- **Thread ID encoding**: `terminal_{base64Url(threadId)}`
- **Terminal ID encoding**: `base64Url(terminalId)`
- **Max retained inactive sessions**: 128 (LRU eviction)

### Known Issues and Quirks

1. **History file deletion on close**: When `deleteHistory: true` is passed to close, the history file is deleted. This is tested but relies on filesystem operations that could fail silently.

2. **Zsh prompt spacer**: When using zsh, the `-o nopromptsp` option is added to prevent `%` end markers. This is a zsh-specific behavior.

3. **Retryable spawn errors**: The `isRetryableShellSpawnError` function checks for common POSIX spawn failure messages (posix_spawnp failed, enoent, not found, file not found, no such file). This suggests the spawn process may need multiple attempts for certain shells.

4. **History capping**: The `capHistory` function truncates history to `maxLines` by keeping only the most recent lines, preserving trailing newline behavior.

5. **Subprocess kill escalation**: When killing a terminal, there's a graceful escalation: SIGTERM first, then SIGKILL after `processKillGraceMs` (1000ms default).

### Implementation Status

| Component              | Status            | Notes                             |
| ---------------------- | ----------------- | --------------------------------- |
| PtyAdapterShape        | Fully implemented | Interface contract                |
| NodePTY                | Fully implemented | Uses node-pty native addon        |
| BunPTY                 | Fully implemented | Uses Bun.spawn                    |
| TerminalManagerShape   | Fully implemented | Interface contract                |
| TerminalManagerRuntime | Fully implemented | Full lifecycle management         |
| History persistence    | Fully implemented | Debounced filesystem writes       |
| Subprocess detection   | Fully implemented | Platform-specific (Windows/POSIX) |
| Shell resolution       | Fully implemented | Platform-specific candidates      |

---

## Git System

### Overview

The Git system provides comprehensive Git repository operations through a layered service architecture. It supports core Git operations, GitHub CLI integration, and AI-powered text generation for commits and PR descriptions.

### Architecture

#### Layer Architecture

**Layers (Business Logic):**

- `apps/server/src/git/Layers/GitCore.ts` - Core Git operations (status, commit, push, pull, worktree, branch management)
- `apps/server/src/git/Layers/GitManager.ts` - High-level workflow orchestration (createBranch, createCommit, pushBranch)
- `apps/server/src/git/Layers/GitHubCli.ts` - GitHub CLI integration (PR creation, PR checks status)
- `apps/server/src/git/Layers/GitService.ts` - Full GitHub integration service combining GitCore + GitHubCli + TextGeneration
- `apps/server/src/git/Layers/CodexTextGeneration.ts` - AI-powered commit message and PR description generation

**Services (Effect-enabled):**

- `apps/server/src/git/Services/GitCore.ts` - GitCore effect layer
- `apps/server/src/git/Services/GitManager.ts` - GitManager effect layer
- `apps/server/src/git/Services/GitHubCli.ts` - GitHubCli effect layer
- `apps/server/src/git/Services/GitService.ts` - GitService effect layer
- `apps/server/src/git/Services/TextGeneration.ts` - TextGeneration effect layer

#### Service Interface Hierarchy

```
GitCoreShape (low-level)
├── status, statusDetails
├── prepareCommitContext, commit
├── pushCurrentBranch, pullCurrentBranch
├── readRangeContext
├── createWorktree, removeWorktree
├── fetchPullRequestBranch
├── ensureRemote, fetchRemoteBranch, setBranchUpstream
├── renameBranch, createBranch, checkoutBranch
└── initRepo, listLocalBranchNames

GitManagerShape (orchestration)
├── GitCore operations (delegates)
├── createBranchOnRemote
├── pushBranch (create + push + PR)
└── createCommitAndPush

GitHubCliShape (GitHub-specific)
├── createPullRequest
└── getPullRequestChecksStatus

GitServiceShape (full integration)
├── All GitCore + GitManager + GitHubCli operations
└── TextGeneration (commit messages, PR descriptions)
```

### Key Data Structures

**GitStatusDetails:**

```typescript
interface GitStatusDetails extends Omit<GitStatusResult, "pr"> {
  upstreamRef: string | null;
}
```

**GitPreparedCommitContext:**

```typescript
interface GitPreparedCommitContext {
  stagedSummary: string;
  stagedPatch: string;
}
```

**GitPushResult:**

```typescript
interface GitPushResult {
  status: "pushed" | "skipped_up_to_date";
  branch: string;
  upstreamBranch?: string | undefined;
  setUpstream?: boolean | undefined;
}
```

**GitRangeContext:**

```typescript
interface GitRangeContext {
  commitSummary: string;
  diffSummary: string;
  diffPatch: string;
}
```

### Error Handling

Errors are defined using Effect's TaggedErrorClass:

```typescript
// apps/server/src/git/Errors.ts
class GitCommandError extends TaggedErrorClass<GitCommandError>()("GitCommandError", {
  cwd: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {}

class GitHubCliError extends TaggedErrorClass<GitHubCliError>()("GitHubCliError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {}

class TextGenerationError extends TaggedErrorClass<TextGenerationError>()("TextGenerationError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {}

class GitManagerError extends TaggedErrorClass<GitManagerError>()("GitManagerError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {}

// Union type used throughout
type GitManagerServiceError =
  | GitManagerError
  | GitCommandError
  | GitHubCliError
  | TextGenerationError;
```

### Configuration Constants

```typescript
const PREFERRED_REMOTE_NAME = "CUT3";
const LEGACY_REMOTE_NAME = "origin";
const DEFAULT_BASE_BRANCH_CANDIDATES = ["main", "master"];
const STATUS_UPSTREAM_REFRESH_INTERVAL = 15_000; // 15 seconds
const STATUS_UPSTREAM_REFRESH_CACHE_CAPACITY = 2_048;
```

### Notable Patterns

1. **Status upstream cache**: GitCore.statusDetails uses an in-memory LRU cache (capacity 2048) that refreshes upstream tracking info every 15 seconds per repository.

2. **GitHub remote resolution**: The system prefers "CUT3" as remote name but falls back to "origin" for backwards compatibility.

3. **Worktree isolation**: Checkpoint captures use isolated temporary Git index files to avoid interfering with user operations.

4. **Text generation integration**: CodexTextGeneration uses a separate service layer to generate commit messages and PR descriptions from staged changes and diff context.

### Implementation Status

| Component                | Status            | Notes                                            |
| ------------------------ | ----------------- | ------------------------------------------------ |
| GitCore operations       | Fully implemented | status, commit, push, pull, branch, worktree     |
| GitManager orchestration | Fully implemented | createBranch, createCommit, pushBranch workflows |
| GitHubCli integration    | Fully implemented | createPullRequest, getPullRequestChecksStatus    |
| TextGeneration           | Fully implemented | Commit messages, PR descriptions via Codex       |
| Status upstream cache    | Fully implemented | 15s refresh, 2048 capacity LRU                   |
| isRepo utility           | Fully implemented | Detects if directory is a Git repo               |

---

## Checkpointing System

### Overview

The checkpointing system captures repository state at specific points ("turns" within threads) using Git refs. It supports saving checkpoints, restoring to previous states, and computing diffs between checkpoints.

### Architecture

**Layers:**

- `apps/server/src/checkpointing/Layers/CheckpointDiffQuery.ts` - Query diffs between checkpoints
- `apps/server/src/checkpointing/Layers/CheckpointStore.ts` - Checkpoint capture and restore
- `apps/server/src/checkpointing/Layers/WorktreeCheckpointService.ts` - Worktree-scoped checkpoints, branch integration, and stacked branch creation

**Services:**

- `apps/server/src/checkpointing/Services/CheckpointDiffQuery.ts` - Effect layer for CheckpointDiffQuery
- `apps/server/src/checkpointing/Services/CheckpointStore.ts` - Effect layer for CheckpointStore
- `apps/server/src/checkpointing/Services/WorktreeCheckpointService.ts` - Worktree-aware checkpoint service contract

**Utilities:**

- `apps/server/src/checkpointing/Utils.ts` - Ref path generation, workspace cwd resolution
- `apps/server/src/checkpointing/Diffs.ts` - Unified diff parsing
- `apps/server/src/checkpointing/Errors.ts` - Error type definitions

### Checkpoint Ref Structure

Checkpoints are stored as Git refs following a naming convention:

```typescript
// In Utils.ts
const CHECKPOINT_REFS_PREFIX = "refs/t3/checkpoints";

function checkpointRefForThreadTurn(threadId: string, turnCount: number): string {
  const base64ThreadId = Encoding.encodeBase64Url(threadId);
  return `${CHECKPOINT_REFS_PREFIX}/${base64ThreadId}/turn/${turnCount}`;
}
```

Example ref: `refs/t3/checkpoints/abc123XYZ/turn/5`

Worktree checkpoints use branch-scoped refs under:

```text
refs/t3/checkpoints/worktrees/{base64url(worktreeBranch)}/{timestamp}-{head}
```

Unlike turn snapshot checkpoints, worktree checkpoints point at the actual worktree branch commit so they can be cherry-picked or merged through normal Git ancestry.

### Data Flow

1. **Capture**: Create Git commit → create/update ref pointing to commit
2. **Restore**: Read ref → checkout specific commit → update working tree
3. **Diff Query**: Read two refs → compute diff between commits → parse unified diff

### Diff Parsing

The `parseTurnDiffFilesFromUnifiedDiff` function (Diffs.ts) parses unified diff output:

```typescript
interface ParsedDiffFile {
  path: string;
  additions: number;
  deletions: number;
}

function parseTurnDiffFilesFromUnifiedDiff(diff: string): Array<ParsedDiffFile>;
```

**Behavior:**

- Returns empty array for empty diffs
- Counts additions (lines starting with `+` excluding `+++` and `Binary`)
- Counts deletions (lines starting with `-` excluding `---` and `Binary`)
- Rename-only diffs (0 additions, 0 deletions) are included with zeros
- Normalizes CRLF to LF

### Workspace Cwd Resolution

The `resolveThreadWorkspaceCwd` function determines the working directory for a thread:

```typescript
function resolveThreadWorkspaceCwd(
  threadWorktreePath: string | null,
  workspaceRoot: string,
): string {
  // Prefer worktreePath over workspaceRoot
  return threadWorktreePath ?? workspaceRoot;
}
```

### Implementation Status

| Component                 | Status            | Notes                                                            |
| ------------------------- | ----------------- | ---------------------------------------------------------------- |
| CheckpointStore           | Fully implemented | Capture, restore, ref management                                 |
| CheckpointDiffQuery       | Fully implemented | Diff between checkpoints                                         |
| WorktreeCheckpointService | Fully implemented | Worktree checkpoints, branch merge/cherry-pick, stacked branches |
| Diff parsing              | Fully implemented | parseTurnDiffFilesFromUnifiedDiff                                |
| Ref generation            | Fully implemented | checkpointRefForThreadTurn                                       |
| Workspace resolution      | Fully implemented | resolveThreadWorkspaceCwd                                        |

---

## Web Client State Management

### Overview

The web client maintains terminal-related state using Zustand with persist middleware, handles terminal activity events, and provides link detection/handling for terminal output.

### Terminal State Store (terminalStateStore.ts)

**Storage:** localStorage key `rowl:terminal-state:v1`

**State Shape:**

```typescript
interface TerminalState {
  terminalOpen: boolean;
  terminalHeight: number;
  terminalIds: string[];
  runningTerminalIds: string[];
  activeTerminalId: string | null;
  terminalGroups: string[][];
}
```

**Key Functions:**

- `normalizeTerminalIds()` - deduplicates and maintains order
- `normalizeRunningTerminalIds()` - deduplicates running terminal IDs
- `assignUniqueGroupId()` - assigns next available group index
- `findGroupIndexByTerminalId()` - finds which group contains a terminal
- `normalizeTerminalGroups()` - ensures groups have valid IDs and caps at 4 terminals

**Actions:**

- `setTerminalOpen(open: boolean)` - toggle terminal panel
- `resizeTerminal(height: number)` - resize terminal panel
- `splitTerminal(threadId: string, newTerminalId: string)` - create new terminal in group
- `newTerminal(threadId: string, terminalId: string)` - create new terminal group
- `setActiveTerminal(terminalId: string | null)` - set active terminal
- `closeTerminal(terminalId: string)` - remove terminal, handle group cleanup
- `setTerminalActivity(terminalId: string, hasRunning: boolean)` - update running state
- `clearTerminalState(threadId: string)` - clear all terminal state for thread
- `removeOrphanedTerminalStates()` - cleanup terminals referencing non-existent threads

**Business Rules:**

- Maximum 4 terminals per group (splitTerminal capped)
- New terminals create new groups if within limit
- Closing default terminal removes orphaned state for that thread
- Closing non-default terminal removes it from group, doesn't create new group

### Terminal Activity (terminalActivity.ts)

Maps TerminalEvent objects to subprocess running state:

```typescript
function terminalRunningSubprocessFromEvent(event: TerminalEvent): boolean | null {
  switch (event.type) {
    case "started":
    case "restarted":
      return false;
    case "exited":
      return false;
    case "activity":
      return event.hasRunningSubprocess;
    default:
      return null;
  }
}
```

### Terminal Links (terminal-links.ts)

**Link Extraction:**

```typescript
const URL_PATTERN = /https?:\/\/[^\s"'`<>]+/g;
const FILE_PATH_PATTERN =
  /\b(?:[\/.](?:home|Users|Volumes)[^\s"'`<>:]+|~\/[^\s"'`<>]+|[A-Za-z]:\\[^\\]+|\\\\[^\s"'`<>]+\\[^\s"'`<>]+|\.\.[^\s"'`<>]+|\/[^\s"'`<>]+)(?::\d+)?(?::line\d+)?(?::col(?:umn)?\d+)?\b/g;
```

**Path Link Resolution:**

- `~` is expanded to home directory
- Relative paths are joined with cwd
- Line/column suffixes preserved (`:line5`, `:col10`)

**Activation Detection:**

```typescript
function isTerminalLinkActivation(event: MouseEvent, urlOrPath: string): boolean {
  // macOS: cmd+click
  // Others: ctrl+click
}
```

### Implementation Status

| Component          | Status            | Notes                                       |
| ------------------ | ----------------- | ------------------------------------------- |
| terminalStateStore | Fully implemented | Zustand with persist                        |
| terminalActivity   | Fully implemented | Event to subprocess state                   |
| terminal-links     | Fully implemented | URL/path extraction, resolution, activation |

---

## Cross-Cutting Concerns

### processRunner Utility

The `processRunner.ts` module provides a generic process spawning utility:

```typescript
interface ProcessResult {
  code: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  timedOut: boolean;
}

interface RunProcessOptions {
  timeoutMs?: number;
  allowNonZeroExit?: boolean;
  maxBufferBytes?: number;
  outputMode?: "truncate" | "error";
  stdin?: string;
}

function runProcess(
  command: string,
  args?: ReadonlyArray<string>,
  options?: RunProcessOptions,
): Promise<ProcessResult>;
```

**Key features:**

- Configurable timeout (default: no timeout)
- Max buffer (default: 8 MB)
- Truncate mode: sets `stdoutTruncated`/`stderrTruncated` flag instead of throwing
- Error mode: throws on buffer overflow
- Stdin input support
- Windows support via taskkill for process termination

### Integration Points

1. **Terminal → Git**: Terminal sessions can run Git commands; Git operations may spawn editors
2. **Terminal → Checkpointing**: Checkpoints capture repository state during terminal sessions
3. **Git → Checkpointing**: Checkpoints use Git refs to store/retrieve state
4. **WebSocket → Terminal**: All terminal operations flow through WebSocket protocol
5. **WebSocket → Git**: Git operations exposed via WebSocket routes

### Security Considerations

1. **Environment isolation**: Terminal sessions exclude ROWL*\*, VITE*\*, and specific dangerous env vars
2. **Path validation**: Cwd assertions ensure sessions don't escape designated directories
3. **Shell escaping**: Arguments are properly handled through PTY layer

### Testing

| Component                   | Test Coverage                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Manager.test.ts             | Close behavior, history deletion, multi-terminal, dispose, env vars, zsh prompt spacer |
| NodePTY.test.ts             | NodePTY-specific behavior                                                              |
| processRunner.test.ts       | Buffer limits, truncate mode                                                           |
| GitCore.test.ts             | Status upstream cache, branch parsing, remote resolution                               |
| GitManager.test.ts          | High-level workflow orchestration                                                      |
| GitHubCli.test.ts           | GitHub CLI operations                                                                  |
| GitService.test.ts          | Full Git service integration                                                           |
| CodexTextGeneration.test.ts | Text generation                                                                        |
| Diffs.test.ts               | Diff parsing (empty, per-file, rename-only, CRLF)                                      |
| terminalStateStore.test.ts  | Terminal state management                                                              |
| terminalActivity.test.ts    | Subprocess detection                                                                   |
| terminal-links.test.ts      | Link extraction, path resolution                                                       |

---

## Summary

### Terminal System

- **Fully implemented** with two PTY adapter implementations (NodePTY, BunPTY)
- Supports multi-terminal sessions per thread with independent history
- Debounced history persistence to filesystem
- Subprocess detection with platform-specific implementations
- Shell resolution with platform-specific candidates

### Git System

- **Fully implemented** layered architecture
- Core Git operations via GitCore, orchestration via GitManager
- GitHub CLI integration via GitHubCli
- AI text generation for commit messages and PR descriptions
- Status upstream caching with 15s refresh and 2048 entry capacity

### Checkpointing System

- **Fully implemented** Git-ref-based checkpoint storage
- Supports capture, restore, and diff queries between checkpoints
- Uses isolated temporary Git index for capture operations
- Unified diff parsing with additions/deletions counting

### Web Client

- **Fully implemented** Zustand-based state management
- Terminal state persistence to localStorage
- Link extraction and platform-aware activation
- Activity event handling for subprocess state

---

_End of document_
