# Stockroom

A small fictional stationery shop with shared inventory, an editor, and an in-memory change log. Native Node HTTP, no third-party packages or external services.

Run with Node 20 or newer: `npm start`. `PORT` defaults to 3000.

Open two browser tabs. Save an item's count in one; saving the older version in the other returns HTTP 412 and preserves the unsaved input. Load latest, review, and save again. Item ETags support conditional GET (304) and HEAD; edits require If-Match (428 without it). Quantity is an integer from zero through the release's configured maximum. The server checks the current revision after collecting the request body. The UI renders data with textContent.

Release 2 allows quantities through 120; release 1 allowed 100. This is a public, synthetic demo without authentication or durable storage. Restart resets all stock. `POST /api/reset` starts a fresh demo; never use it for real inventory. API inputs are limited to 4096 UTF-8 bytes. `GET /api/health` identifies the release. Logs report method and path, never request bodies.
