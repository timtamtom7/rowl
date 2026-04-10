# Rowl Agent Guidance

## Task Completion Requirements

- All of `bun run fmt`, `bun run lint`, and `bun run typecheck` must pass before considering tasks completed.
- Always use `bun run test` (runs Vitest), not bare `bun test`.
- Do not claim something works unless you verified it with the relevant tests, checks, or tool output.
- If a change affects user-visible behavior, settings, build steps, release steps, or developer workflows, update the relevant documentation in the same change as part of the implementation.
- Treat stale docs as a bug. A task is not complete until `README.md`, `CONTRIBUTING.md`, `.docs/*`, `docs/*`, and any task-specific guides touched by the change are accurate.
- Update `AGENTS.md` too when a task exposes a repeatable mistake, workflow correction, or durable lesson that should guide future work.
- Keep developer docs aligned with the current `ROWL_*` dev-runner env names. `dev:web` and `dev:server` are expected to share one port offset per `ROWL_STATE_DIR`, so docs should not describe them as independently drifting port selections.
- Keep `apps/web/vitest.browser.config.ts` explicitly prebundling `vitest/browser` and `vitest-browser-react`; cold-cache browser runs can otherwise fail before tests start because the optimized browser bundle imports raw Vitest browser helpers.
- Keep Linux Electron smoke runs CI-safe: GitHub-hosted Linux runners need the smoke harness to add `--no-sandbox`, or Electron exits before Rowl can emit the desktop backend ready marker.
- Keep release hardening aligned across workflow + docs: reuse the preflight desktop bundle with `dist:desktop:artifact -- --skip-build` instead of rebuilding the JS pipeline in every packaging job, always publish/verify `SHA256SUMS`, gate signed macOS/Windows releases through the `ROWL_REQUIRE_SIGNING` policy instead of silently shipping unsigned artifacts when signing is expected, and keep manual `dry_run` releases non-mutating by skipping both GitHub Release publishing and the finalize version-bump push to `main`.

## Provider Availability

Keep provider availability claims in docs and onboarding copy aligned with `apps/web/src/session-logic.ts` and its tests.

Current providers:

- **Available**: Codex, OpenRouter, GitHub Copilot, Kimi Code, OpenCode, Pi
- **Coming soon**: Gemini
- **Unavailable placeholders**: Claude Code, Cursor

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there are shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Package Roles

- `apps/server`: Node.js HTTP/WebSocket server. Serves the React web app, owns orchestration/project/git/terminal APIs, and routes provider sessions for Codex, GitHub Copilot, OpenCode, Kimi Code, and Pi.
- `apps/web`: React/Vite UI. Owns session UX, conversation/event rendering, composer/settings controls, plan sidebar flows, and client-side state. Connects to the server via WebSocket.
- `apps/desktop`: Electron shell. Starts a desktop-scoped `t3` backend, loads the shared web app, and exposes native dialogs, menus, and desktop update flows.
- `packages/contracts`: Shared Effect Schema schemas and TypeScript contracts for provider events, WebSocket protocol, keybindings, and model/session types. Keep this package schema-only — no runtime logic.
- `packages/shared`: Shared runtime utilities consumed by both server and web. Uses explicit subpath exports (e.g. `@t3tools/shared/git`) — no barrel index.

## Provider Runtimes

Rowl exposes one orchestration/WebSocket surface, then delegates provider-native runtime behavior to provider adapters and managers.

How we use it in this codebase:

- Codex sessions are brokered through `codex app-server` (JSON-RPC over stdio) in `apps/server/src/codexAppServerManager.ts`.
- GitHub Copilot sessions are brokered through ACP-backed runtime management in `apps/server/src/copilotAcpManager.ts`.
- OpenCode sessions are brokered through ACP-backed runtime management in `apps/server/src/opencodeAcpManager.ts`.
- Kimi Code sessions are brokered through ACP-backed runtime management in `apps/server/src/kimiAcpManager.ts`, including optional API-key-backed startup.
- Pi sessions are brokered through the embedded `@mariozechner/pi-coding-agent` Node SDK in `apps/server/src/piSdkManager.ts`, while Rowl intentionally disables Pi's own resource discovery so repo instructions still come only from Rowl.
- Cross-provider routing and shared runtime event fan-out are coordinated in `apps/server/src/provider/Layers/ProviderService.ts`.
- WebSocket request handling and push channels are served from `apps/server/src/wsServer.ts`.
- The web app consumes orchestration domain events plus terminal/server push channels over WebSocket.

For future tool-backed providers, prefer runtimes with a native app-server or ACP surface instead of inventing a bespoke terminal wrapper. OpenCode's `opencode acp` is the current best-fit substrate for new plan-backed integrations because it matches Rowl's existing ACP provider pattern.

## Key Environment Variables

- `ROWL_AUTH_TOKEN`: WebSocket auth token
- `ROWL_STATE_DIR`: State directory (default: `~/.t3/rowl`)
- `ROWL_MODE`: Runtime mode (`desktop`, `web`)
- `ROWL_PORT`: Server port
- `ROWL_DEV_INSTANCE`: Multiple dev instances (shifts ports)
- `ROWL_PORT_OFFSET`: Numeric port offset
- `ROWL_REQUIRE_SIGNING`: Require signing for releases
- `ROWL_ENABLE_PROVIDER_EVENT_LOGS`: Enable provider event logging

## Reference Repos

- Open-source Codex repo: https://github.com/openai/codex
- Codex-Monitor (Tauri, feature-complete, strong reference implementation): https://github.com/Dimillian/CodexMonitor
- Pi mono repo (`packages/coding-agent`): https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent
