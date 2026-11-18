<script lang="ts">
  import { page } from '$app/state';
  import { strudel, store } from '$lib';
  import '../main.scss';
  import { setGlobalContext } from '$lib/context';
  import { base } from '$app/paths';
  import type { IceServer } from '$lib/turn';

  function searchParamsHelper() {
    const params = page.url.searchParams;
    return {
      get: (key: string) => params.get(key) ?? undefined,
      getNumber: (key: string) => {
        const v = params.get(key);
        return v ? Number(v) : undefined;
      },
      has: (key: string) => params.has(key),
      getAll: (key: string) => params.getAll(key)
    };
  }
  let { data = { iceServers: [] } }: { data?: { iceServers: IceServer[] } } = $props();
  const params = searchParamsHelper();
  const isJoin = params.has('join');
  const isHost = params.has('host');
  const audioRunning = strudel.audioRunning;
  const room = params.get('room');
  const isDebug = params.has('debug');
  if (!room || (!isJoin && !isHost)) {
    goto(`${base}/home`);
  }
  console.error('params', params, isJoin, isHost, room);

  if (isDebug && typeof window !== 'undefined') installRtcDebug(); // before the room is joined
  const relay = params.get('relay');
  // ?signal=mqtt: signal over public MQTT brokers instead of Nostr relays
  const signal = params.get('signal') === 'mqtt' ? 'mqtt' : 'nostr';
  initStore(isHost, room!, {
    relayUrls: relay ? [relay] : undefined,
    signal,
    iceServers: data.iceServers
  });
  // `?debug` exposes the store so e2e tests (and the console) can inspect and drive it
  if (isDebug && typeof window !== 'undefined') {
    (window as any).__store = store;
    (window as any).__strudel = strudel;
    (window as any).__acoustics = { WebAcoustics, findChirp, makeChirp };
  }
  setGlobalContext({
    host: isHost,
    debug: isDebug,
    roomId: room!,
    // the views name notes in the song's key (getters: it can change); code generation reads the store
    get scaleKey() {
      return store.scale.scaleKey;
    },
    get scaleMode() {
      return store.scale.scaleMode;
    }
  });

  function onKeyDown(event: KeyboardEvent) {
    // keys typed into a control belong to it, not to the song (Space on a focused button clicks it)
    if (
      (event.target as HTMLElement | null)?.closest?.(
        'input, textarea, select, button, [role="slider"]'
      )
    )
      return;

    switch (event.code) {
      case 'Space':
        store.dispatch({ type: 'transport', action: 'toggle' });
        break;
      case 'Escape':
        store.dispatch({ type: 'transport', action: 'stop' });
        break;
      case 'KeyA':
        presetCommands().forEach(store.dispatch);
        break;
      default:
        break;
    }
  }

  const instrumentsData = store.instrumentsData;
  // console.log($instrumentsData.instrumentsData);
  let code = $state(store.code());
  // let group = $state('0');
  $effect(() => {
    code = store.code();
    // every peer plays the song itself, following the host's clock (unless only the host makes sound)
    if (isHost || !store.transport.hostOnly) strudel.evaluate(code);
  });

  // The page shown (screen, instrument) lives in the browser's history: switching pages pushes an
  // entry (shallow routing: the URL stays), and Back / Forward bring one back.
  const nav = new NavHistory(
    (state) => pushState('', { nav: $state.snapshot(state) }),
    (state) => replaceState('', { nav: $state.snapshot(state) })
  );
  $effect(() => nav.restore(page.state?.nav));

  // Leaving while the music plays or others are here asks first. Leaving the site (closing, reloading,
  // Back past the first page) can only get the browser's own "Leave site?" dialog, and only once the
  // page has been interacted with (never on iOS Safari); links within the app get a confirm.
  // Back/Forward between this page's own entries is not leaving: same URL, so it is let through.
  beforeNavigate((navigation) => {
    if (!shouldConfirmLeave({ playing, peers: store.peers.length })) return;
    if (navigation.willUnload) {
      navigation.cancel(); // makes the browser ask
      return;
    }
    const to = navigation.to?.url;
    if (to && to.pathname === page.url.pathname && to.search === page.url.search) return;
    if (!confirm(playing ? 'Leave the jam? The music will stop.' : 'Leave the jam?'))
      navigation.cancel();
  });
  const ids = $derived(instrumentsData.instrumentsData.map((i) => i.id));

  import PhoneApp from '../components/phone/PhoneApp.svelte';
  import DesktopApp from '../components/desktop/DesktopApp.svelte';
  import {
    NavHistory,
    desktopIndex,
    desktopSelect,
    navIndex,
    phoneScreen,
    shouldConfirmLeave
  } from '$lib/nav.svelte';
  import { Media, PHONE_QUERY } from '$lib/utils/media.svelte';
  import { initStore } from '$lib/Store.svelte';
  import { presetCommands } from '$lib/commandBuilders';
  import { beforeNavigate, goto, pushState, replaceState } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getRelaySockets as getNostrSockets } from 'trystero';
  import { getRelaySockets as getMqttSockets } from '@trystero-p2p/mqtt';
  import { installRtcDebug, refreshRtcStats, relaySummary, rtcSummary } from '$lib/rtcDebug';
  import { WebAcoustics } from '$lib/calibration/webAcoustics';
  import { findChirp, makeChirp } from '$lib/calibration/dsp';
  const phone = new Media(PHONE_QUERY);
  let playing = $derived(store.transport.playing);
  /** A guest's browser keeps audio locked until their first tap. */
  let needsTap = $derived(!isHost && playing && !store.transport.hostOnly && !$audioRunning);

  // `?debug` on a phone: are the signalling relays reachable?
  let relays = $state('');
  let rtcLines = $state<string[]>([]);
  let relayLines = $state<string[]>([]);
  /** Nostr relays drop events stamped before the receiver's subscription, so a skewed clock breaks signalling. */
  let skew = $state('');
  async function measureSkew() {
    try {
      const t0 = Date.now();
      const res = await fetch(`${location.origin}${base}/`, { method: 'HEAD', cache: 'no-store' });
      const t1 = Date.now();
      const server = Date.parse(res.headers.get('date') ?? '');
      if (Number.isNaN(server)) return;
      const secs = Math.round((t0 + t1) / 2000 - server / 1000);
      skew = `clock ${secs >= 0 ? '+' : ''}${secs}s vs server (±1s)`;
    } catch {
      skew = 'clock unknown';
    }
  }
  let copied = $state(false);
  async function copyDebug() {
    const text = [
      `${relays} · peers ${store.peers.length} · secure context ${window.isSecureContext} · turn servers ${data.iceServers.length}`,
      `time ${new Date().toISOString()} · ${skew} · ${navigator.userAgent}`,
      ...relayLines,
      ...rtcLines
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard blocked: fall back to selecting nothing; the text is still on screen
      return;
    }
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
  onMount(() => {
    if (!isDebug) return;
    void measureSkew();
    const id = setInterval(() => {
      const sockets = Object.entries(signal === 'mqtt' ? getMqttSockets() : getNostrSockets());
      void refreshRtcStats();
      rtcLines = rtcSummary();
      relayLines = relaySummary();
      relays = `relays ${sockets.filter(([, s]) => s.readyState === 1).length}/${sockets.length} open`;
    }, 1000);
    return () => clearInterval(id);
  });

  // Playhead: exact on the host, extrapolated from the host's messages on clients.
  let position = $state(0);
  onMount(() => {
    const id = setInterval(() => (position = store.transport.position()), 50);
    return () => clearInterval(id);
  });
</script>

{#snippet debugPanel()}
  <p class="text-sm" data-testid="net-debug">
    {relays} · peers {store.peers.length} · secure context {String(window.isSecureContext)} · turn servers
    {data.iceServers.length} · {skew}
  </p>
  <button class="btn preset-outlined w-fit" data-testid="copy-debug" onclick={copyDebug}
    >{copied ? 'Copied' : 'Copy debug text'}</button
  >
  {#each relayLines as line}<p class="text-xs" data-testid="relay-debug">{line}</p>{/each}
  {#each rtcLines as line}<p class="text-xs" data-testid="rtc-debug">{line}</p>{/each}
  <details class="bg-surface-900 border-surface-700 rounded-2xl border p-3">
    <summary class="cursor-pointer text-sm">Code</summary>
    <div class="flex gap-2 py-2">
      <button class="btn btn-sm preset-outlined" onclick={() => store.cycle()}>Cycle</button>
      <button
        class="btn btn-sm preset-outlined"
        onclick={() => navigator.clipboard.writeText(store.exportLog())}>Copy log</button
      >
    </div>
    <pre class="text-xs whitespace-pre-wrap">{code}</pre>
  </details>
{/snippet}

{#if phone.matches}
  <PhoneApp
    bind:selectedIndex={() => navIndex(nav.current, ids), (i) => nav.go({ instrumentId: ids[i] })}
    bind:screen={() => phoneScreen(nav.current, ids), (screen) => nav.go({ screen })}
    dispatch={store.dispatch}
    {position}
    {playing}
    now={() => store.transport.heardPosition()}
    {isHost}
    roomId={room!}
    {needsTap}
    hostOnly={!isHost && store.transport.hostOnly}
    onTap={() => strudel.unlockAudio()}
    debug={isDebug ? debugPanel : undefined}
  />
{:else}
  <DesktopApp
    bind:selectedIndex={() => desktopIndex(nav.current, ids), (i) => nav.go(desktopSelect(i, ids))}
    dispatch={store.dispatch}
    {position}
    {playing}
    now={() => store.transport.heardPosition()}
    {isHost}
    roomId={room!}
    {needsTap}
    hostOnly={!isHost && store.transport.hostOnly}
    onTap={() => strudel.unlockAudio()}
    debug={isDebug ? debugPanel : undefined}
  />{/if}

<svelte:window on:keydown={onKeyDown} />
