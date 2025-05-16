<script lang="ts">
	import { castProps, store, type IInstrumentViewProps, type ITypedInstrumentViewProps, type PianoScale, type PianoScaleData } from "$lib";

    // let p:  IInstrumentViewProps = $props();
    // let {instrumentData,index} = p as ITypedInstrumentViewProps<PianoScaleData>;
    const props:IInstrumentViewProps = $props();
    let {instrumentData,index} = castProps<PianoScaleData>(props);

    let rnd = () => {
        const data  = {notes: instrumentData.notes.map((note) => {
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