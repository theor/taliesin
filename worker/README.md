# TURN credentials Worker

Peers that cannot reach each other directly (mobile data, strict NATs, isolated Wi-Fi) need a TURN relay.
Cloudflare Realtime TURN issues short-lived credentials through an authenticated API, so this tiny Worker
holds the API token and gives the app `{ iceServers }`.

1. Cloudflare dashboard -> Realtime -> TURN: create a TURN key. Note the key id and the API token.
2. **Deploy from GitHub (recommended).** Add these repository *secrets* (Settings -> Secrets and variables ->
   Actions -> Secrets): `CLOUDFLARE_API_TOKEN` (a token created from the "Edit Cloudflare Workers" template),
   `CLOUDFLARE_ACCOUNT_ID`, `TURN_KEY_ID`, `TURN_API_TOKEN`. Then run the "Deploy TURN credentials Worker"
   workflow (Actions tab -> Run workflow); it also runs on every push to `main` that touches `worker/`.
   Its log prints the Worker's URL.

   **Or deploy by hand**, from this folder:
   ```
   npx wrangler secret put TURN_KEY_ID
   npx wrangler secret put TURN_API_TOKEN
   npx wrangler deploy
   ```
   Edit `ALLOWED_ORIGINS` in `wrangler.toml` if the site is not on `https://theor.github.io`.
3. In GitHub: Settings -> Secrets and variables -> Actions -> Variables: add `TURN_ENDPOINT` = the Worker URL
   (e.g. `https://taliesin-turn.<you>.workers.dev`). The deploy workflow passes it to the build as
   `VITE_TURN_ENDPOINT`. For a quick test, open the app with `?turn=<worker url>`.

The Worker only answers requests from the allowed origins (and localhost / LAN addresses for development).
