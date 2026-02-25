# Post Corith Engineering Overview

## Purpose

Post Corith is a local-first HTTP client for interactive API debugging. It uses a React frontend for request composition and a local Express proxy to execute upstream requests so the browser UI can work around CORS restrictions during development.

## Runtime Architecture

- Frontend (`src/App.jsx`) builds request payloads and calls `POST /api/request`
- Vite dev server proxies `/api/*` to the local Express server during development
- Express (`server/index.js`) validates the payload, performs the upstream `fetch`, enforces timeout/response-size limits, and returns a normalized response object
- In production-ish local runs (`npm start` after `npm run build`), the same Express server also serves the built frontend from `dist/`

## Key Files

- `src/App.jsx`
  - Main app component and nearly all UI/state/request logic
  - Request builders (params/headers/body/auth)
  - Response views, search, image previews, export/import, history
- `src/index.css`
  - CSS variables for theme tokens and dark mode values
  - Custom styles for the JSON syntax-highlight editor overlay
- `src/main.jsx`
  - React bootstrap
- `server/index.js`
  - Proxy API (`/api/health`, `/api/request`)
  - Response byte limit enforcement
  - Static asset serving for `dist/`
- `vite.config.js`
  - Dev server port (`5173`)
  - Proxy config to backend (`127.0.0.1:8787`)

## Frontend State Model (High-Level)

The app keeps most state inside `App` with React hooks.

- `tabs`: request tabs and persisted request config
- `activeTabId`: active workspace tab
- `requestTab` / `responseTab`: visible UI sub-tabs
- `history`: local recent request snapshots (capped)
- `theme` / `darkMode`: visual settings
- `isSending`, `copyFeedback`, export/import modal state: transient UI state

### Persisted Local Storage Keys

- `post-corith-tabs`
- `post-corith-active-tab`
- `post-corith-theme`
- `post-corith-dark`
- `post-corith-history`

Important detail:
- Persisted tabs intentionally exclude `response`, `requestError`, and `responseSearch` when saved.

## Request Flow (Frontend to Backend)

1. `executeRequest()` reads the active tab and calls `createPayload(tab)`.
2. `createPayload()`:
   - normalizes URL (`http://` added if missing)
   - merges enabled query params
   - builds headers from enabled rows
   - injects bearer token header if provided
   - serializes body by mode (`json`, `raw`, `form`)
   - auto-adds `Content-Type` for JSON/form when absent
   - validates JSON body text before sending
3. Frontend sends the normalized payload to `POST /api/request`.
4. Proxy executes upstream fetch and returns normalized response data.
5. Frontend stores response in the active tab and pushes a summary snapshot into local history.

## Backend Proxy Behavior (`server/index.js`)

### Validation and Guardrails

- Accepts methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Only allows upstream `http:` / `https:` URLs
- Clamps timeout to `500..120000ms`
- Reads upstream response stream with a max byte cap (`MAX_RESPONSE_BYTES`)
- Rejects oversized responses with HTTP `413`
- Returns timeouts as HTTP `504`
- Returns upstream/proxy failures as HTTP `502`

### Response Normalization

Proxy response JSON includes:

- `status`, `statusText`
- `headers` (plain object)
- `body` (UTF-8 string)
- `isJson` (best-effort)
- `json` (parsed object if parse succeeds, else `null`)
- `sizeBytes`
- `elapsedMs`

Important detail:
- Upstream bodies are always decoded as UTF-8 for the UI. Binary payloads are not preserved as raw bytes.

## UI Features Engineers Should Know About

### Request Workspace

- Multi-tab request editing
- Desktop tab pills and mobile dropdown for the same underlying state
- Reset current tab preserves tab identity but resets request config/response state
- Import/export includes tabs + history (export format currently `version: 1`)

### JSON Body Editor

- Uses an overlay/highlight approach:
  - visible syntax-highlighted `<pre>` overlay
  - transparent `<textarea>` on top for editing/caret/input
- Validation is live via `validateJsonDraft()`
- Error messages attempt to include line/column extracted from JSON parse errors

### Response Viewer

- Pretty/raw/headers tabs
- Search with match navigation
- Search throttling behavior for large payloads:
  - payloads over ~5000 lines require 3+ chars unless the query has regex special chars
- Image preview scans parsed JSON for `b64_json` fields (up to `MAX_IMAGE_PREVIEWS = 6`)

## Theming and Styling Notes

- Tailwind is configured to read from CSS custom properties (`--surface-*`, `--ink-*`, `--accent-*`)
- Accent color theme is selected via `data-theme` and CSS variable sets in `src/index.css`
- Dark mode is applied with the `.dark` class (Tailwind `darkMode: "class"`)
- App also writes `data-theme` and background color to `document.documentElement` for full-page visual consistency outside the app container

## Development Workflow

### Common Commands

- `npm run dev` -> runs client + server together
- `npm run dev:client` -> Vite only
- `npm run dev:server` -> Express proxy only
- `npm run build` -> build frontend
- `npm start` -> run proxy/static server

### Local Endpoints

- UI (dev): `http://localhost:5173`
- Proxy health: `http://127.0.0.1:8787/api/health`
- Proxy request API: `POST http://127.0.0.1:8787/api/request`

## Extension Points (What To Change For New Features)

- New auth type:
  - add UI in request auth panel
  - extend tab shape in `makeTab()`
  - merge headers in `createPayload()`
  - include fields in history/export/import snapshots

- New body mode:
  - add mode button in body tab UI
  - add editor UI branch
  - add serialization branch in `createPayload()`
  - update import/export compatibility if new fields are added

- Additional response renderers (e.g. HTML, image, XML prettify):
  - extend response tab state/options
  - add rendering path using `activeTab.response`
  - keep `getResponseTextForTab()` aligned with download/copy behavior

## Known Technical Debt / Risks

- `src/App.jsx` is large and mixes state, business logic, and rendering in one file
- Import parsing is permissive and silently ignores malformed files
- History snapshots reuse stored row shapes; future schema changes need migration logic
- Proxy decodes all upstream responses as UTF-8 text, which is not ideal for arbitrary binary APIs
- No automated tests currently cover request serialization, proxy limits, or import/export compatibility

## Practical Onboarding Notes

- If a request fails, check both browser console/network and the Express server logs
- For "works in UI but not direct fetch" differences, remember the browser talks to the local proxy, not the upstream API directly
- When changing persisted tab/history schema, test:
  - fresh load
  - reload with existing `localStorage`
  - export -> import round trip
  - history replay into active tab
