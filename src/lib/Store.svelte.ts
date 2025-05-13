import type { Component, ComponentType } from "svelte"
import PianoScaleView from "../instruments/PianoScaleView.svelte";
import { PianoScale, type IInstrument, type IInstrumentData, type IInstrumentViewProps, type Instrument } from "./interfaces";
import { writable, type Writable } from "svelte/store";

// interface State {
//     instrumentViews: {
//         // component: ComponentType<IInstrumentViewProps<any>>,
//         instrument: Instrument<any>
//     }[];
// }
// export const store: Writable<State> = writable({
//     instrumentViews: [
//         { component: PianoScaleView, instrument: new PianoScale() },
//         { component: PianoScaleView, instrument: new PianoScale({notes:[5,6]}) },
//     ],
// })

// let _store = $state<State>({
//     instrumentViews: [
//         {
//             // component: PianoScaleView,
//             instrument: new PianoScale()
//         },
//         {
//             // component: PianoScaleView,
//             instrument: new PianoScale({ notes: [5, 6] })
//         },
//     ],
// })

class AppStore {
    instrumentsData = $state([] as IInstrumentData[]);
    instruments = $state([] as Instrument<any>[]);
    code = () => {
        return this.instruments.map((i,index) => `$: ${i.generate(this.instrumentsData[index])}`).join("\n");
    };
    createInstrument<T extends Instrument<TD>, TD extends IInstrumentData>(instr: T, data?: Partial<TD>){
        // const instr = new T();
        this.instruments.push(instr);
        let rdata = instr.createData();
        if(data)
            rdata = {...rdata, ...data};
        this.instrumentsData.push(rdata);

    }
    constructor() {
        this.createInstrument(new PianoScale(), {notes:[1,3,5]});
        this.createInstrument(new PianoScale(), {notes:[1,2,3,4]});

    }
    setInstrument(index: number, data: IInstrumentData) {
        // this.instruments[index].data = data;
        // !!!! state must be IInstrumentData[]
        // this.instruments[index] = {...this.instruments[index], data };
        this.instrumentsData[index] = data;
        // this.instruments = [...this.instruments, this.instruments[0]]; // trigger reactivity
    };
}

export const store = new AppStore();

// export const store = {
//     get value() {
//         return _store;
//     },
//     setInstrument(index: number, data: IInstrumentData) {
//         _store.instrumentViews[index].instrument.data = data;
//     },
// }