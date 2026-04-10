# CI quality gates

- `.github/workflows/ci.yml` runs the core repo quality gates on `ubuntu-24.04`: `bun run fmt:check`, `bun run lint`, `bun run typecheck`, `bun run test`, and the browser suite via `bun run --cwd apps/web test:browser`.
- The same CI workflow also runs a desktop smoke matrix on Linux, macOS, and Windows. Each matrix job builds `bun run build:desktop`, verifies the preload bundle markers, and runs `bun run test:desktop-smoke` (`xvfb-run -a` on Linux).
- CI now caches Electron/electron-builder downloads for the desktop smoke matrix in addition to Bun/Turbo, which keeps the multi-OS smoke coverage but reduces repeat package/download time.
- `.github/workflows/release.yml` still builds macOS (`arm64` and `x64`), Linux (`x64`), and Windows (`x64`) desktop artifacts from a single `v*.*.*` tag and publishes one GitHub release.
- The release workflow preflight reruns the browser suite plus the Linux desktop build/smoke path before the per-platform packaging matrix starts, aligns package versions to the release tag, then archives and uploads the prebuilt `apps/desktop/dist-electron` and `apps/server/dist` bundle so each packaging job can extract it and reuse `--skip-build` instead of rebuilding the JS pipeline four times.
- Release jobs now cache Bun/Turbo and Electron downloads, upload binary artifacts with `compression-level: 0`, and publish a `SHA256SUMS` manifest after verifying the downloaded release assets.
- The release workflow still auto-enables signing when Apple or Azure Trusted Signing secrets are present, and it can now be hardened to fail macOS/Windows releases if signing secrets are missing by setting `ROWL_REQUIRE_SIGNING=true` or using the `require_signing` workflow-dispatch input.
- The release workflow also supports a non-mutating `workflow_dispatch` dry run via `dry_run=true`; that path builds and validates the full release asset set, uploads a workflow artifact, and skips both GitHub Release publishing and the final version-bump push to `main`.
- CLI npm publishing is optional and no longer blocks GitHub Releases; enable it with the `publish_cli` workflow-dispatch input or the `ROWL_PUBLISH_CLI=true` repository variable.
- See `docs/release.md` for the full release/signing/checksum checklist.
