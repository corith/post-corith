# Post Corith

Lightweight Postman-style HTTP client for local development and API debugging.

<p align="center">
  <img src="https://github.com/user-attachments/assets/71cb65bb-e8cc-492e-9ac3-1666e4991080" width="400" />
</p>

## What It Does

Post Corith is a React UI backed by a local Express proxy. The browser app builds requests, then sends them to `/api/request` on the local proxy so the proxy can perform the upstream HTTP call (avoiding normal browser CORS limitations).

## Current Features

- Multi-request workspace with tabbed requests (desktop pills + mobile selector)
- HTTP methods in UI: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Query params editor with per-row enable/disable
- Bearer token auth helper (auto-adds `Authorization: Bearer ...`)
- Header editor with per-row enable/disable
- Body modes:
  - `None`
  - `JSON` (syntax-highlighted editor + inline validation/error location)
  - `Raw`
  - `Form URL Encoded`
- Per-request timeout control (`500ms` to `120000ms`)
- Response tabs: pretty / raw / headers
- Response metadata: status / elapsed time / payload size
- Response search with match navigation (optimized for large payloads)
- Base64 image preview + download for JSON responses containing `b64_json`
- Response save-to-file and copy-to-clipboard
- Local recent history (one-click restore into current tab)
- Workspace export/import (tabs + history)
- Theme color picker + dark mode, persisted locally

## Tech Stack

- Frontend: React 18 + Vite + Tailwind CSS
- Backend: Node.js + Express (local proxy server)
- Dev tooling: Vite proxy + `concurrently`

## Getting Started (Dev)

```bash
npm install
npm run dev
```

- Frontend UI: [http://localhost:5173](http://localhost:5173)
- Proxy health check: [http://127.0.0.1:8787/api/health](http://127.0.0.1:8787/api/health)

`npm run dev` starts both:
- Vite client on `5173`
- Express proxy on `8787`

## Build / Run (Production-ish Local)

```bash
npm run build
npm start
```

Notes:
- `npm run build` outputs the frontend to `dist/`
- `npm start` runs only the Express server
- If `dist/` exists, the Express server serves the built frontend and falls back to `dist/index.html` for non-API routes

## Environment Variables (Proxy)

- `PORT` (default `8787`)
- `HOST` (default `127.0.0.1`)
- `MAX_RESPONSE_BYTES` (default `52428800`, min `65536`, hard max `52428800`)

Examples:

```bash
HOST=0.0.0.0 PORT=8787 npm run dev:server
MAX_RESPONSE_BYTES=10485760 npm run dev:server
```

## Proxy Behavior / Limits

- Allowed upstream URL protocols: `http`, `https`
- Proxy-accepted methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Request body is omitted for bodyless methods (`GET`, `HEAD`)
- Proxy request timeout is clamped to `500ms..120000ms`
- Upstream responses are read with a size cap and returned as UTF-8 text
- JSON is parsed opportunistically for pretty view (content type or parseable body)

## Local Persistence

The app stores workspace state in `localStorage`:

- `post-corith-tabs`
- `post-corith-active-tab`
- `post-corith-theme`
- `post-corith-dark`
- `post-corith-history`

Response bodies and transient UI errors are not persisted in saved tabs.

## Project Layout

- `src/App.jsx`: main UI and request/response logic (currently monolithic)
- `src/index.css`: theme variables + custom editor styles
- `src/main.jsx`: React bootstrap
- `server/index.js`: Express proxy + static serving
- `vite.config.js`: Vite dev server + `/api` proxy to local backend

## Scope / Non-Goals (Current)

- No collections/workspaces sync
- No scripted tests or assertions
- No multipart/form-data file upload UI
- No OAuth flows or advanced auth beyond bearer token helper

## Engineering Docs

- Engineering overview: [overview.md](./overview.md)
