<script lang="ts">
  import { AppBar } from '@skeletonlabs/skeleton-svelte';
  import Menu from '@lucide/svelte/icons/menu';
  import { page } from '$app/state';
  import { strudel, store } from '$lib';
  import '../main.scss';
  import Network from '../components/Network.svelte';
  import Transport from '../components/Transport.svelte';
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
    scaleKey: 'A',
    scaleMode: 'minor'
  });

  function onKeyDown(event: KeyboardEvent) {
    console.log(event, event.code);

    switch (event.code) {
      case 'Backquote':
        drawerState = !drawerState;
        break;
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
  let title = 'Taliesin';

  const instrumentsData = store.instrumentsData;
  // console.log($instrumentsData.instrumentsData);
  let code = $state(store.code());
  // let group = $state('0');
  let selectedIndex = $state(0);
  let currentInstrument = $derived(instrumentsData.instrumentsData[selectedIndex]);
  $effect(() => {
    // console.log('store changed', $state.snapshot(instrumentsData.instrumentsData), instrumentsData.instrumentsData[0]);
    code = store.code();
    strudel.evaluate(code); // every peer plays the song itself, following the host's clock
    if (selectedIndex >= instrumentsData.instrumentsData.length) {
      selectedIndex = instrumentsData.instrumentsData.length - 1;
    }
  });

  import { Modal } from '@skeletonlabs/skeleton-svelte';
  import AppMenu from '../components/AppMenu.svelte';
  import InstrumentView from '../components/InstrumentView.svelte';
  import { initStore, mixerIndex } from '$lib/Store.svelte';
  import Mixer from '../components/Mixer.svelte';
  import { presetCommands } from '$lib/commandBuilders';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getRelaySockets as getNostrSockets } from 'trystero/nostr';
  import { getRelaySockets as getMqttSockets } from 'trystero/mqtt';
  import { installRtcDebug, refreshRtcStats, relaySummary, rtcSummary } from '$lib/rtcDebug';
  import { WebAcoustics } from '$lib/calibration/webAcoustics';
  import { findChirp, makeChirp } from '$lib/calibration/dsp';
  const calibration = store.calibration;
  const calibrationNote = $derived.by(() => {
    if (calibration.running) return 'Listening… keep the room quiet';
    return Object.values(calibration.results)
      .map((r) =>
        r.status === 'ok' ? `calibrated (${Math.round(r.delay * 1000)} ms)` : r.reason
      )
      .join(' · ');
  });
  let drawerState = $state(false);

  function drawerClose() {
    drawerState = false;
  }

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
    const id = setInterval(() => (position = store.transport.position()), 100);
    return () => clearInterval(id);
  });
</script>

<AppBar headlineClasses="sm:hidden" centerClasses="hidden sm:block" toolbarClasses="">
  {#snippet lead()}
    <!-- <ArrowLeft size={24} /> -->
    <Network />
  {/snippet}
  {#snippet trail()}
    <div class="hidden space-x-4 sm:flex">
      <Transport playing={store.transport.playing} {position} dispatch={store.dispatch} />
      {#if !isHost && store.transport.playing && !$audioRunning}
        <button class="btn preset-filled" onclick={() => strudel.unlockAudio()}>Tap to hear</button>
      {/if}
      {#if isHost && store.peers.length > 0}
        <button
          class="btn preset-tonal"
          disabled={calibration.running || store.transport.playing}
          title="The host's microphone listens while each device plays a test sound, so every device can be lined up with this one. Stop the song and keep the room quiet."
          onclick={() => calibration.run(store.peers)}>Calibrate</button
        >
        {#if calibrationNote}<span class="self-center text-sm" data-testid="calibration-note"
            >{calibrationNote}</span
          >{/if}
      {/if}
      {#if !isHost && calibration.applied !== undefined}
        <button
          class="btn preset-outlined"
          title="Calibrated by the host. Click to go back to the browser's own estimate."
          onclick={() => calibration.reset()}
          >Synced {Math.round(calibration.applied * 1000)} ms ✕</button
        >
      {/if}
    </div>
    <div class="block md:hidden">
      <Modal
        open={drawerState}
        onOpenChange={(e) => (drawerState = e.open)}
        triggerBase="btn preset-tonal"
        contentBase="card border-surface-100-900 border-[1px] space-y-4 shadow-xl  h-screen"
        positionerJustify="justify-start"
        positionerAlign=""
        positionerPadding=""
        closeOnInteractOutside={true}
        transitionsPositionerIn={{ x: -480, duration: 200 }}
        transitionsPositionerOut={{ x: -480, duration: 200 }}
      >
        {#snippet trigger()}<Menu size={20} />{/snippet}
        {#snippet content()}
          <AppMenu {drawerClose} bind:selectedIndex dispatch={store.dispatch} />
        {/snippet}
      </Modal>
    </div>
  {/snippet}
  <span>{title}</span>
</AppBar>

<div class="flex h-full flex-row">
  <div class="card border-surface-100-900 hidden flex-col border-[1px] md:flex">
    <AppMenu bind:selectedIndex dispatch={store.dispatch} />
  </div>

  <div class="flex flex-1 flex-col gap-4 p-4">
    {#if isDebug}
      <p class="text-sm" data-testid="net-debug">
        {relays} · peers {store.peers.length} · secure context {String(window.isSecureContext)} · turn servers {data.iceServers.length} · {skew}
      </p>
      <button
        class="btn preset-outlined w-fit"
        data-testid="copy-debug"
        onclick={copyDebug}>{copied ? 'Copied' : 'Copy debug text'}</button
      >
      {#each relayLines as line}<p class="text-xs" data-testid="relay-debug">{line}</p>{/each}
      {#each rtcLines as line}<p class="text-xs" data-testid="rtc-debug">{line}</p>{/each}
      <div
        class="card preset-outlined-surface-200-800 bg-surface-50-950 hidden flex-col space-y-5 p-5 lg:flex"
      >
        Code
        <div class="flex flex-row">
          <button class="btn preset-outlined ml-4" onclick={() => store.cycle()}>Cycle</button>
          <button
            class="btn preset-outlined ml-4"
            onclick={() => navigator.clipboard.writeText(store.exportLog())}>Copy log</button
          >
        </div>
        <pre class="whitespace-pre-wrap">
{code}
            </pre>
        <!-- <pre>{store.serialized()}</pre> -->
      </div>
    {/if}

    {#if selectedIndex === mixerIndex}
      <Mixer song={store.instrumentsData} dispatch={store.dispatch} />
    {:else if currentInstrument}
      <InstrumentView
        bind:instrumentData={currentInstrument}
        index={selectedIndex}
        dispatch={store.dispatch}
      />
      <!-- {@render instrumentCard(currentInstrument, selectedIndex)} -->
    {/if}

    <!-- {#each instrumentsData.instrumentsData as instrumentData, index}
			{@render instrumentCard(instrumentData, index)}
		{/each} -->
    <!-- <Tabs value={group} onValueChange={(e) => (group = e.value)}>
			{#snippet list()}
				{#each instrumentsData.instrumentsData as instrumentData, index}
					<Tabs.Control value={index.toString()}>{instrumentData.instrumentName}</Tabs.Control>
				{/each}
			{/snippet}
			{#snippet content()}
				{#each instrumentsData.instrumentsData as instrumentData, index}
					<Tabs.Panel value={index.toString()}>
						{@render instrumentCard(instrumentData, index)}
					</Tabs.Panel>
				{/each}
			{/snippet}
		</Tabs> -->
  </div>
</div>

<svelte:window on:keydown={onKeyDown} />
