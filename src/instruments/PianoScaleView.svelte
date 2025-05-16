<script lang="ts">
	import { store, type IInstrumentViewProps, type ITypedInstrumentViewProps, type PianoScale, type PianoScaleData } from "$lib";

    // let p:  IInstrumentViewProps = $props();
    // let {instrumentData,index} = p as ITypedInstrumentViewProps<PianoScaleData>;
    const props:IInstrumentViewProps = $props();
    let instrumentData = props.instrumentData as PianoScaleData;

    let rnd = () => {
        const notes = instrumentData.notes.map((note) => {
            return Math.floor(7+Math.random() * 7);
        });
        instrumentData.notes = notes;
        // store.setInstrument(props.index, data);
        // console.log($state.snapshot(store.instrumentsData))
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