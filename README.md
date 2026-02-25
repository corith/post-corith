# Post Corith

A lightweight Postman-style HTTP client for development workflows.

<p align="center">
  <img src="https://github.com/user-attachments/assets/71cb65bb-e8cc-492e-9ac3-1666e4991080" width="400" />
</p>


## Stack
- React + Vite + Tailwind frontend
- Node.js + Express proxy backend (`/api/request`) to avoid browser CORS limits

## Features
- Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Bearer token authorization
- Query parameter editor
- Custom headers editor (enable/disable rows)
- Body modes: none, JSON, raw text, form-url-encoded
- Response viewer tabs: pretty, raw, headers
- Response metadata: status, time, payload size
- Local request history with one-click replay
- Timeout control and request error handling

## Run

```bash
npm install
npm run dev
```

Frontend: [http://localhost:5173](http://localhost:5173)  
Proxy backend: [http://127.0.0.1:8787/api/health](http://127.0.0.1:8787/api/health)

## Notes
- Requests are executed server-side through the local Node proxy. This allows calling local APIs and network APIs from the UI.
- The proxy binds to `127.0.0.1` by default (override with `HOST` if you intentionally need remote access).
- Large upstream responses are capped by `MAX_RESPONSE_BYTES` (default `52428800` / 50 MB) to avoid crashing the app on huge payloads.
- This tool is focused on request/response iteration only (not test suites, monitors, or collaboration features).
