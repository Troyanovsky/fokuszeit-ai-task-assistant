# FokusZeit Technical Review

Date: 2026-01-05  
Scope: Repository `ai-task-assistant/` (Electron 36 + Vue 3 + Vite 6 + SQLite via better-sqlite3; AI via OpenAI-compatible tool calling)

## Executive Summary

FokusZeit has a clear high-level architecture (Electron main process owns persistence/AI/notifications; renderer owns UI via Vue/Vuex) and a generally sound security baseline for Electron (notably `contextIsolation: true` and `nodeIntegration: false` in `app/electron.js`). The project also has a meaningful unit-test footprint across services and Vuex modules.

The highest-risk gaps are around (1) **secret storage** (API keys in plaintext via `electron-store`), (2) **renderer hardening** (missing CSP and navigation controls), and (3) **LLM/tool safety** (no “human-in-the-loop” controls for destructive tool calls). On the maintainability side, there are a few concrete correctness issues (Vuex action signatures, dead/incorrect routing code) and recurring patterns that will become costly at scale (in-memory filtering of tasks/notifications, verbose logging, synchronous DB access on the main thread).

## System Architecture (As Implemented)

### Process Separation

- **Main process** (`app/electron.js`, `app/electron-main/*`)
  - Bootstraps window, initializes DB and notification subsystem.
  - Hosts AI orchestration (`app/electron-main/aiService.js`), function execution (`app/electron-main/functionHandlers.js`), and IPC handlers (`app/electron-main/ipcHandlers.js`).
- **Preload** (`app/preload.cjs`)
  - Exposes a curated `window.electron` API via `contextBridge` for IPC calls and event subscription.
- **Renderer** (`app/src/*`)
  - Vue UI + Vuex modules; uses `window.electron.*` for all persistence and AI interactions.
  - Business logic exists both in renderer services and main services (some shared modules are imported from both sides).

### Data Flow Overview

1. UI dispatches Vuex actions (e.g., `tasks/fetchTasks`) → calls `window.electron.getRecentTasks()` from preload.
2. `ipcMain.handle(...)` in `app/electron-main/ipcHandlers.js` calls service layer in `app/src/services/*` (running in main process context).
3. Service layer uses `app/src/services/database.js` (better-sqlite3) with parameter binding (`?`) to read/write SQLite.
4. Main process emits refresh events (`tasks:refresh`, `projects:refresh`, etc.) → renderer subscribes via `window.electron.receive(...)`.

## Component Responsibilities & Separation of Concerns

### Strengths

- The IPC surface is explicitly enumerated in one place (`app/preload.cjs`), which is a good security posture for Electron.
- The DB layer is centralized (`app/src/services/database.js`), and SQL is mostly parameterized.
- Models provide transformation between DB (snake_case) and app (camelCase), e.g. `Task.fromDatabase()` / `Task.toDatabase()`.

### Issues / Opportunities

- **Main process imports renderer services**: `app/electron.js` and IPC handlers import modules under `app/src/services/*`. This blurs the boundary between main and renderer concerns and complicates bundling/testing, especially where renderer-only utilities (e.g., `window.logger`) are referenced.
- **Mixed module system and logger selection**: Several services attempt to use `require(...)` inside ESM modules (e.g., `app/src/services/task.js`, `app/src/services/project.js`, `app/src/services/dataIntegrity.js`). In Node ESM, `require` is not defined; the catch path falls back to `console.*`, undermining the project’s own logging standard.
- **UI routing mismatch / dead code**: `app/src/components/system/NotificationListener.vue` attempts to route to `{ name: 'project' }`, but the router only defines `Home` and `Settings` (`app/src/router/index.js`). This is either stale or incomplete.
- **Vuex action API misuse**: `fetchTasksByProject` in `app/src/store/modules/tasks.js` has a non-standard signature `(context, projectId, { fetchAll } = {})`. Vuex only passes a single payload argument, so the third parameter is never provided; `fetchAllTasksByProject` attempts to pass a third argument via `dispatch`, which Vuex interprets as dispatch options (not payload). This makes “fetch all vs. recent” per-project behavior unreliable.

## Code Quality & Maintainability

### Positive Signals

- Clear directory structure and naming conventions (models/services/store/components).
- ESLint + Prettier are configured (`app/eslint.config.js`, `app/.prettierrc`).
- Tests exist for core layers (main AI service, DB service, service layer, Vuex modules).

### Maintainability Risks

- **Very large modules**: `app/electron-main/functionHandlers.js` is a monolith with multiple responsibilities (validation/parsing/filtering/formatting/tool dispatch). This will become harder to safely extend.
- **Verbose logging in hot paths**: Task/AI query handlers log extensive per-entity information (e.g., due dates for every task). This hurts performance and increases privacy risk (logs contain personal task content).
- **Out-of-date docs**: `doc/Folder_Structure.md` lists files that no longer exist (e.g., `TaskList.vue`), reducing trust in docs.
- **Lint coverage gaps**: `app/eslint.config.js` ignores `**/*.test.js`, so tests may drift from standards and accumulate issues unnoticed.

## Security Review (Risks & Best Practices)

### High-Risk Findings (Prioritize)

1. **API keys stored in plaintext on disk**
   - `electron-store` is used for AI settings and preferences (`app/electron-main/aiService.js`, `app/src/services/preferences.js`).
   - Risk: local malware/other users can read keys; keys can leak via backups, support bundles, etc.
   - Recommendation: store secrets in OS-protected storage (Electron `safeStorage` + user prompt, or `keytar`/Keychain/Credential Manager). Keep `electron-store` for non-secrets.

2. **No Content Security Policy (CSP) / navigation hardening**
   - `app/index.html` has no CSP; `app/electron.js` does not set `webContents.setWindowOpenHandler`, `will-navigate` guards, or explicit navigation policies.
   - Risk: XSS becomes “full app compromise” because any injected JS can call `window.electron.*` IPC APIs.
   - Recommendation: add a strict CSP (even a pragmatic one compatible with Vite), block unexpected navigation, and deny window opens by default.

3. **LLM tool safety / prompt injection exposure**
   - The AI agent can invoke destructive tools (e.g., delete operations) without any user confirmation or policy checks (`app/electron-main/aiService.js`, `app/electron-main/functionHandlers.js`).
   - Risk: prompt injection or misunderstood instruction can delete data or exfiltrate content.
   - Recommendation: require explicit user confirmation for destructive actions, add “dry run”/preview mode, and enforce policy checks in the main process (never rely on prompt discipline).

### Medium-Risk Findings

- **Sensitive data in logs**
  - AI requests/responses are logged (`app/electron-main/aiService.js`), and task queries can log details per record (`app/electron-main/functionHandlers.js`).
  - Recommendation: add log redaction, make request/response logging opt-in, and avoid writing user content at `info` level.

- **User-configurable `apiUrl`**
  - The AI endpoint can be set arbitrarily (`configureAI`), and the API key is sent in an `Authorization` header to that endpoint.
  - Recommendation: default to HTTPS-only for non-local endpoints; warn loudly and/or block sending credentials over plaintext HTTP; consider allowlisting well-known endpoints.

### Existing Good Practices

- `contextIsolation: true` and `nodeIntegration: false` in `app/electron.js`.
- IPC event channels are whitelisted for listeners in `app/preload.cjs`.
- SQL statements generally use `?` parameters (good baseline against SQL injection).

## Performance Considerations

### Observed Bottlenecks

- **Synchronous SQLite on the main thread**
  - `better-sqlite3` is synchronous; heavy queries or loops will block the main process, affecting UI responsiveness.
  - Recommendation: keep operations small and indexed; consider moving heavy work to a worker thread if the dataset grows.

- **In-memory filtering for AI queries**
  - `queryTasks` / `queryNotifications` fetch a broad set then filter in JS (`app/electron-main/functionHandlers.js`).
  - Recommendation: push filtering and limits into SQL (with indexes) to reduce CPU and memory.

- **Refetch-on-mutation patterns**
  - Vuex actions often refetch full lists after writes (known inefficiency noted in docs).
  - Recommendation: add targeted updates/optimistic updates (especially for large task lists).

### Quick Wins

- Add indexes for common query paths: `tasks(project_id)`, `tasks(status)`, `tasks(due_date)`, `tasks(planned_time)`, `notifications(task_id)`, `notifications(time)`.
- Reduce log verbosity in loops; log counts/ids rather than full objects by default.

## Testing Strategy & Gaps

### Current State

- Vitest is used (`app/package.json`).
- Coverage includes:
  - Main AI orchestration tests (`app/electron-main/__tests__/aiService.test.js`).
  - Service-layer unit tests (`app/src/services/__tests__/*`).
  - Vuex module unit tests (`app/src/store/modules/__tests__/*`).
- Mocks are used effectively for `electron`, `electron-store`, DB primitives, etc.

### Gaps / Improvements

- No automated UI/component tests were found (no component `__tests__` under `app/src/components`).
- No end-to-end tests across preload ↔ IPC ↔ main ↔ renderer boundaries.
- Tests are excluded from linting (`app/eslint.config.js` ignores `**/*.test.js`), which reduces signal-to-noise over time.

## Adherence to Industry Standards

### Strengths

- Uses recommended Electron security basics (context isolation, no node integration).
- Uses a model/service separation pattern and parameterized DB statements.
- Has automated unit tests and common tooling (ESLint/Prettier/Vitest).

### Deviations / Risks

- Secrets handling is not aligned with common desktop security practice (OS keychain storage).
- Missing CSP/navigation policy is below common Electron hardening guidance.
- Some files do not start with tool-supported file-level documentation comments (inconsistent with repository standards; e.g., `app/src/services/logger.js`, store modules).
- Dev workflow exposes Vite server on all interfaces (`npm run electron:dev` uses `vite --host`), which can be risky on shared networks.

## Prioritized Recommendations

### P0 (Do Next)

1. **Move API key storage to OS-protected secret storage**
   - Use `keytar` or `safeStorage`; never store secrets in plaintext JSON.
2. **Add CSP + navigation hardening**
   - Add CSP (renderer) and `webContents` navigation controls (main process).
3. **Add “human-in-the-loop” controls for destructive AI actions**
   - Confirm deletes and other irreversible operations; add policy guardrails in main process.
4. **Stop logging sensitive LLM payloads by default**
   - Redact or disable request/response body logging; keep high-level diagnostics.

### P1 (Stabilize)

1. **Fix Vuex action signatures and routing inconsistencies**
   - Correct `fetchTasksByProject` payload handling; remove or fix `NotificationListener` route usage.
2. **Use DB transactions for multi-step operations**
   - Particularly for project deletion and any multi-entity updates; rely on `ON DELETE CASCADE` where appropriate.
3. **Unify logging approach across ESM**
   - Remove `require` patterns in ESM; standardize imports and ensure logs go through `electron-log`.

### P2 (Scale & Maintain)

1. **Move filter-heavy AI queries into SQL and add indexes**
   - Reduces CPU and memory, improves latency for large datasets.
2. **Introduce bounded chat history and request controls**
   - Cap chat history size; add timeouts/retries for `axios` calls; avoid unbounded growth.
3. **Add component tests and a minimal IPC integration test**
   - Catch regressions where renderer ↔ preload ↔ main contract changes.

### P3 (Quality & Developer Experience)

1. **Lint tests and main-process code**
   - Remove `**/*.test.js` from ESLint ignores or lint tests in CI only.
2. **Refresh /doc documentation**
   - Update `doc/Folder_Structure.md` and add an “architecture” doc aligned with current structure.

## Appendix: Notable File References

- Main entry: `app/electron.js`
- Preload bridge: `app/preload.cjs`
- IPC handlers: `app/electron-main/ipcHandlers.js`
- AI orchestration: `app/electron-main/aiService.js`
- AI tool execution: `app/electron-main/functionHandlers.js`
- DB wrapper: `app/src/services/database.js`
- Task service: `app/src/services/task.js`
- Store modules: `app/src/store/modules/*.js`

