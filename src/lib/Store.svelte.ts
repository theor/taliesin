import { createInstrument, getInstrument, type PianoScaleData, type IInstrumentData, type IInstrumentViewProps } from "./interfaces";
import { syncedStore, getYjsValue, getYjsDoc } from "@syncedstore/core";
import { svelteSyncedStore } from "@syncedstore/svelte";
import { WebrtcProvider } from "y-webrtc";
// export interface ICommand {
//     name: string;
// }

type PlayCommand = {
    name: "play";
    value: boolean;
}
type SetDataCommand = {
    name: "setData";
    index: number;
    value: {};
}
type Command = SetDataCommand | PlayCommand;

class AppStore {
	setInstrumentData<TD extends IInstrumentData>(_: TD, index: number, data: Partial<TD>) {
		const commands = this.commands;
        this.synchedStore.commands.push({ name: "setData", index, value: data });
	}
    clearCommands() {
        this.synchedStore.commands.splice(0, this.synchedStore.commands.length);
    }
    synchedStore = syncedStore({ commands: [] as Command[] });
    commands = svelteSyncedStore(this.synchedStore);
    instrumentsData = $state([] as IInstrumentData[]);
    doc = getYjsDoc(this.synchedStore);
    webrtcProvider = new WebrtcProvider("rave/#", this.doc,{ signaling: [
        // 'wss://y-webrtc-ckynwnzncc.now.sh', 
        'ws://localhost:4444'
    ] });
    // commands = $state([] as Command[]);
    code = () => {
        return this.instrumentsData.map((i) => {
            const instr = getInstrument(i);
            return `$: ${instr.generate(i)}`;
        }).join("\n");
    };
    constructor() {
        this.instrumentsData.push(createInstrument( { instrumentName:"PianoScale", notes: [1, 2, 3] }));
        this.instrumentsData.push(createInstrument({instrumentName:"Drum"} ));
        this.webrtcProvider.connect();
    }
    setInstrument(index: number, data: IInstrumentData) {
        console.log("setInstrument", index, $state.snapshot(data));
        
        this.instrumentsData[index] = data;
    };
}

export const store = new AppStore();