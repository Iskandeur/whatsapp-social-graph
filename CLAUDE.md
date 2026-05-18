# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

WhatsApp Social Graph visualizes a user's WhatsApp network as an interactive
force-directed graph. It connects to WhatsApp through Waha (WhatsApp HTTP API),
fetches chats/contacts/messages, and renders people and groups as nodes.

## Running the app

The app runs as three Docker Compose services and is normally run entirely through Docker:

```bash
docker-compose up -d              # start waha + server + client
docker-compose up -d --build      # rebuild after package.json changes
docker logs whatsapp-social-graph-server-1   # server logs (also -waha-1, -client-1)
```

Open http://localhost:5173, then scan the QR with WhatsApp -> Linked Devices.

Host ports are configurable via env vars: `WAHA_HOST_PORT` (3000), `SERVER_HOST_PORT`
(3001), `CLIENT_HOST_PORT` (5173). Inside the containers the server always listens on
3001 and the client on 5173; `VITE_SERVER_PORT` tells the client which host port to
reach the server on.

Both server and client mount their source as volumes with hot reload (nodemon / vite),
so code edits apply without rebuilding — rebuild only when a `package.json` changes.

### Per-service commands

```bash
cd client && npm run dev      # vite dev server
cd client && npm run build    # production build
cd client && npm run lint     # eslint (client only)
cd server && npm run dev      # nodemon
cd server && npm start        # node index.js
```

There is no test suite, and no linting is configured for the server.

## Architecture

Three services:
- **waha** — `devlikeapro/waha` container, the WhatsApp gateway (WEBJS/Puppeteer
  engine). API key and dashboard credentials are set in `docker-compose.yml`.
- **server** — Node/Express + Socket.IO. Talks to Waha over HTTP, builds the graph,
  pushes it to clients.
- **client** — React 19 + Vite + TailwindCSS, renders the graph with
  `react-force-graph-2d`.

### Data flow

1. `server/index.js` polls Waha every second (`checkWahaStatus`). It surfaces QR codes,
   detects auth, and — once Waha status is `WORKING` — triggers graph processing.
2. `processData` (`server/dataProcessor.js`) fetches contacts, chats, and a capped
   number of messages per chat, then builds the graph and insights.
3. The result is cached in memory on the server (`cachedGraphData` / `cachedStats` /
   `cachedInsights`) and broadcast via the `data_ready` Socket.IO event. The cache is
   lost on server restart; processing then re-runs automatically.
4. `client/src/App.jsx` receives `data_ready`, stores the **full** graph, and derives
   the visible graph client-side via the `filteredGraphData` memo. All filtering (view
   mode, min messages, time range, etc.) happens on the client — the server always
   sends everything.

Socket.IO events: server emits `qr`, `status`, `progress`, `data_ready`; client emits
`start_processing` (re-fetch with a new message limit / archived toggle) and `logout`.

### Graph model

`processData` produces `{ nodes, links }`:
- **Nodes** are people or groups. People are classified as: the `Me` node, "green"
  (`isMyContact`), or "blue" (an unknown number whose name is still just digits).
- **Link types**: `DIRECT` (Me <-> person), `MEMBERSHIP` (person <-> group),
  `CO_MEMBER` (person <-> person sharing a group, weighted by shared-group count).
- **View modes** (filtered in `App.jsx`): *Groups* mode shows `MEMBERSHIP` + `DIRECT`
  and hides `CO_MEMBER`; *Social* mode hides group nodes and `MEMBERSHIP` links,
  showing inferred `CO_MEMBER` + `DIRECT`.
- Disconnected nodes (no links/messages/groups) are dropped to avoid a huge "hairball".
- **Insights** (`computeInsights`): top contacts/groups, super-connectors, and
  "unexpected bridges" — people connecting socially disjoint groups, scored with
  Jaccard similarity between group member sets.

### ID normalization

`normalizeId` in `dataProcessor.js` strips device suffixes (`:0@`) and rewrites `@lid`
IDs to `@c.us`. Every WhatsApp ID must pass through it before being used as a node key
or compared, otherwise nodes fragment and fail to match.

## Waha fragility

Waha is unreliable for large accounts, and the code is deliberately defensive around it:
- `getContacts` may fail entirely (500 errors) — `processData` falls back to deriving
  contact names from chat metadata.
- `getChats` paginates; a later-page failure returns partial results, but a first-page
  failure throws.
- `WahaClient.retry` retries only 5xx / network errors with exponential backoff; 4xx
  errors are treated as permanent.
- Timeouts are set high (5 min) because large accounts are slow.
- Archived chats are skipped unless `includeArchived` is passed (re-fetch via the UI
  Reload control).

`dataProcessor.js` contains leftover `[DEBUG TARGET]` logging keyed to specific
hardcoded phone numbers — safe to ignore or remove.
