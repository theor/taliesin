<script lang="ts">
	import type { IInstrumentViewProps, PianoScale, PianoScaleData } from "$lib";

    let {instrumentData, onChange}:  IInstrumentViewProps<PianoScaleData> = $props();

    let rnd = () => {
        instrumentData.notes = instrumentData.notes.map((note) => {
            return Math.floor(Math.random() * 100);
        });
        onChange(instrumentData);
    };
</script>

<div>
    <!-- <h2>{instrument.name}</h2>
    <pre>
        {instrument.generate()}
    </pre> -->
    <pre>data: {JSON.stringify(instrumentData)}</pre>
    <button onclick={rnd}>Randomize</button>
</div>