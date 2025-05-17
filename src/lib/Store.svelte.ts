import { createInstrument, getInstrument, type PianoScaleData, type IInstrumentData, type IInstrumentViewProps } from "./interfaces";
class AppStore {
    instrumentsData = $state([] as IInstrumentData[]);
    code = () => {
        return this.instrumentsData.map((i) => {
            const instr = getInstrument(i);
            return `$: ${instr.generate(i)}`;
        }).join("\n");
    };
    constructor() {
        this.instrumentsData.push(createInstrument( { instrumentName:"PianoScale", notes: [1, 2, 3] }));
        this.instrumentsData.push(createInstrument({instrumentName:"Drum"} ));
    }
    setInstrument(index: number, data: IInstrumentData) {
        console.log("setInstrument", index, $state.snapshot(data));
        
        this.instrumentsData[index] = data;
    };
}

export const store = new AppStore();