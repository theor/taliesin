<script lang="ts">
	import type { IInstrumentViewProps, PianoScale } from "$lib";

    let {instrument}:  IInstrumentViewProps<PianoScale> = $props();
</script>

<div>
    <h2>{instrument.name}</h2>
    <pre>
        {instrument.generate()}
    </pre>
    <pre>data: {JSON.stringify(instrument.data)}</pre>
</div>