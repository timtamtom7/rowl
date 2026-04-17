# Architecture

Rowl ships as a shared web app plus an optional Electron desktop shell, backed by a Node.js server that exposes HTTP/WebSocket APIs and routes work to provider-specific runtimes.

```
┌──────────────────────────────┐
│ Browser                      │
│ or Electron desktop shell    │
└──────────────┬───────────────┘
            │ loads shared UI
┌──────────────▼───────────────┐
│ apps/web (React + Vite)      │
│ session UI, settings, plans  │
└──────────────┬───────────────┘
            │ HTTP + WebSocket
┌──────────────▼───────────────────────────────────┐
│ apps/server (Node.js)                            │
│ static hosting, ws transport, orchestration,     │
│ project/git/terminal APIs, ProviderService       │
└──────────────┬───────────────────────────────────┘
            │ provider adapters / managers
    ┌────────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────┐
    │        │          │          │          │          │          │        │
┌─▼─────┐ ┌▼───────┐ ┌▼────────┐ ┌▼────────┐ ┌▼────────┐ ┌▼────────┐ ┌▼─────┐
│ Codex │ │Copilot │ │KiloCode │ │ Kimi    │ │MiniMax  │ │OpenCode │ │ Pi   │
│ app-  │ │ ACP    │ │ ACP     │ │ ACP     │ │ direct  │ │ ACP     │ │ SDK  │
│ server│ │ runtime│ │ runtime │ │ runtime │ │ API     │ │ runtime │ │runtime│
└───────┘ └────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └──────┘
```

- `apps/web` is the shared client surface for browser and desktop usage.
- `apps/desktop` starts a desktop-scoped `t3` backend, hosts the shared UI in Electron, and exposes native dialogs, menus, and updater flows.
- `apps/server` serves the built UI, validates WebSocket requests, owns orchestration, and routes provider-native work through the provider layer.
- Codex uses `codex app-server` over JSON-RPC stdio.
- GitHub Copilot, KiloCode, OpenCode, and Kimi Code use ACP-backed runtime managers.
- MiniMax uses a direct API manager with OpenAI-compatible SSE streaming.
- Pi uses the embedded `@mariozechner/pi-coding-agent` Node SDK while Rowl keeps Pi packages, resource discovery, and system-prompt discovery disabled.
