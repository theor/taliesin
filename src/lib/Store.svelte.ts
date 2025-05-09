import type { Component } from "svelte"
import PianoScaleView from "../instruments/PianoScaleView.svelte";
import { PianoScale, type IInstrument, type IInstrumentData, type IInstrumentViewProps, type Instrument } from "./interfaces";
import { writable, type Writable } from "svelte/store";

interface State {
    instrumentViews: { component: Component<IInstrumentViewProps<any>>, instrument: Instrument<any> }[];
}
// export const store: Writable<State> = writable({
//     instrumentViews: [
//         { component: PianoScaleView, instrument: new PianoScale() },
//         { component: PianoScaleView, instrument: new PianoScale({notes:[5,6]}) },
//     ],
// })

let _store = $state<State>({
    instrumentViews: [
        { component: PianoScaleView, instrument: new PianoScale() },
        { component: PianoScaleView, instrument: new PianoScale({notes:[5,6]}) },
    ],
})

export const store = {
    get value() {
        return _store;
    },
    setInstrument(index: number, data: IInstrumentData){
        _store.instrumentViews[index].instrument.data = data;
    },
}