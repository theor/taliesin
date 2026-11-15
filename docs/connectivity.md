# Connectivity: what we learned getting a phone to join a PC host

Peers find each other through public signalling (Nostr relays, or MQTT brokers with `?signal=mqtt`) and then
talk over WebRTC, with a Cloudflare TURN relay as fallback (`worker/`, `src/lib/turn.ts`).

## Outcome

A phone (Chrome, Wi-Fi) could not join a PC host (Firefox) on the deployed site: signalling worked, the media
connection never came up, nothing replicated. It worked after two changes shipped together, with and without
`?signal=mqtt`:

1. **Trystero 0.21 -> 0.27** (`src/lib/netRoom.ts` adapts the new API). Trickle ICE is on by default, so
   candidates are sent as they are found instead of after gathering finishes.
2. **Trimmed TURN list** (`trimIceServers` in `src/lib/turn.ts`): one STUN, one UDP TURN, one TLS-443 TURN.
   Cloudflare lists 6 TURN URLs, which gave about 9 relay candidates per connection and ~100 candidate pairs.

We did not test the two separately, so we cannot say which one mattered. The leading explanation: Trystero
destroys an offer that is not connected within ~4.8 s (`announceIntervals * 0.9` in its `strategy.js`), and the
old non-trickle handshake with many relay candidates was too slow on a phone. That is a hypothesis that fits
the logs (`ice=disconnected conn=failed` on the answering side), not a proven cause.

## Ruled out along the way

- **Clock skew.** Nostr relays only deliver events stamped at or after the receiver's own subscription
  (`since: now()`), so a phone clock that is off by more than a few seconds silently breaks signalling.
  `?debug` shows `clock +Ns vs server`; ours were within 2 s.
- **Browser pairing.** Chromium <-> Firefox over the Cloudflare relay connects (relay-only and unrestricted).
- **TURN capacity.** 20 simultaneous relay-only connections with the same credentials all opened in ~1.1 s.
- **Public Nostr relays.** The same failure happened over MQTT.

## Gotchas

- **Secure context is required.** Trystero uses `crypto.subtle`, which browsers only provide on HTTPS or
  `localhost`. On `http://<lan-ip>:port` every signalling step fails silently (`sent=0`, `peers 0`). To test on
  a phone over the LAN, enable `chrome://flags/#unsafely-treat-insecure-origin-as-secure` for that origin, or
  use the deployed HTTPS site. `?debug` shows `secure context`.
- **Many `pc…` lines are normal.** Trystero pre-builds a pool of 20 offers at page load, and makes a new offer
  for every announcement from every relay. Unused ones stay `have-local-offer`; unanswered ones are closed.
- **A page with both `?host` and `?join` flags, or a different `signal`, never meets the others.** Host and
  guests must use the same signalling network; the share link and QR code carry `debug` and `signal`.
- **Desktop browsers in phone-simulation mode** report a phone user agent. Check `cand=host1` (a phone, one
  mDNS host candidate) versus `host4` (a desktop with several adapters) before trusting a label.
- **TURN secrets** (`TURN_KEY_ID`, `TURN_API_TOKEN`) live only as Cloudflare Worker *secrets*, never in the
  repo, `wrangler.toml` or plain vars. The Worker answers only the allowed origins (`worker/README.md`).

## Reading `?debug`

Add `&debug` to the URL (the share link keeps it). **Copy debug text** puts everything on the clipboard.

- Header line: `relays N/M open · peers N · secure context · turn servers N · clock ±Ns`.
- `relay <host> sent= ok= rejected= recv= max=`: per Nostr relay, events sent / accepted / rejected (with the
  relay's reason) / received, and the biggest event. MQTT brokers are binary, so these stay 0 there.
- `pcN sig= ice= conn= cand= remote= pairs= turn= t=[…]` per RTCPeerConnection:
  - `cand`: candidates we gathered (host / srflx / relay). `remote`: what the other peer sent (`-` = no answer yet).
  - `pairs`: candidate-pair states from `getStats` (`succeeded1 used` = a path works).
  - `turn=yes|NO`: whether TURN servers were configured. `?1` in `cand` is just the end-of-candidates marker.
  - `t=[…]`: state changes as `ice:checking@41.2` (seconds since page load), to see when a connection died.

How to read it:
- No `pc` lines, or `sent=0` on a healthy relay: signalling (clock, secure context, relay rejections).
- `have-local-offer` and `remote=-` for ever: the answer never arrived (wrong room / `signal`, relay drops).
- `sig=stable` then `ice=failed` or `disconnected`, with `pairs` stuck at `in-progress`: the media path
  (NAT, TURN not configured or unreachable, or a handshake slower than Trystero's ~5 s limit).

## Reproducing locally

- `yarn test:e2e` runs two Chromium pages over real WebRTC through a local Nostr relay (`e2e/relay.mjs`).
- Same-LAN phone test without the public relays: run the relay (`startRelay(4869)` from `e2e/relay.mjs`),
  start the dev server with `E2E=1` on a free port and `--host`, and open
  `http://<pc-ip>:<port>/?join&room=x&debug&relay=ws://<pc-ip>:4869` (needs the secure-context flag above).
- Relay-only check against the real Worker: build two `RTCPeerConnection`s with
  `iceTransportPolicy: 'relay'` and the Worker's `iceServers`; they should open a data channel in well under a
  second.
