import type { Component } from "svelte"
import PianoScaleView from "../instruments/PianoScaleView.svelte";
import { PianoScale, type IInstrument, type IInstrumentViewProps, type Instrument } from "./interfaces";
import { writable, type Writable } from "svelte/store";

interface State {
    instrumentViews: { component: Component<IInstrumentViewProps<any>>, instrument: Instrument<any> }[];
}
export const store: Writable<State> = writable({
    instrumentViews: [
        { component: PianoScaleView, instrument: new PianoScale() },
        { component: PianoScaleView, instrument: new PianoScale({notes:[5,6]}) },
    ],
    // add more state properties as needed
})