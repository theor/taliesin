<script lang="ts">
	import { store, type IInstrumentViewProps, type PianoScale, type PianoScaleData } from "$lib";

    let {instrumentData,index}:  IInstrumentViewProps = $props();
    const instrumentData2 = instrumentData as PianoScaleData;

    let rnd = () => {
        const data  = {notes: instrumentData2.notes.map((note) => {
            return Math.floor(7+Math.random() * 7);
        })};
        store.setInstrument(index, data);
        console.log($state.snapshot(store.instruments))
        // onChange(instrumentData);
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