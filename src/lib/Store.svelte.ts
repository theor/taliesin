import { createInstrument, getInstrument, type PianoScaleData, type IInstrumentData, type IInstrumentViewProps, Status } from "./interfaces";
import { joinRoom } from 'trystero/nostr';
import { selfId, type ActionSender, type JsonValue } from 'trystero'

const config = {
    appId: 'taliesin',
    // relayUrls: ["wss://192.168.1.82:3334"]
}
const room = joinRoom(config, 'room1');

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
    value: Partial<IInstrumentData>;
}
type Command = SetDataCommand | PlayCommand;
type WrappedInstrument = {
    index: number;
    instrument: IInstrumentData & {[key: string]: JsonValue};
}
class AppStore {
	randomize(index: number) {
		const instr = getInstrument(this.instrumentsData.instrumentsData[index]);
        if (instr) {
            const data = instr.randomize($state.snapshot(this.instrumentsData.instrumentsData[index]));
            this.setInstrumentPartial(index, data);
        }
	}
    
    clearCommands() {
        // this.synchedStore.commands.splice(0, this.synchedStore.commands.length);
    }
    instrumentsData = $state({ instrumentsData: [] as IInstrumentData[] });
    code = () => {
        return this.instrumentsData.instrumentsData.map((i) => {
            const instr = getInstrument(i);
            return instr ? `$: ${instr.generate(i)}` : "";
        }).join("\n");
    };
    status(): Status {
        // return Status.connected;
        return Status.disconnected;
    }
    id() {
        return selfId;// this.webrtcProvider.doc.clientID;
    }
    host: boolean = false;
    peerJoined(peerId: string) {
        console.log("peer joined", peerId);
        if (this.host)
            this.sendState(this.instrumentsData.instrumentsData, peerId);
    }
    peerLeft(peerId: string) {
        console.log("peer left", peerId);
    }

    sendState: ActionSender<IInstrumentData[]>;
    sendInstrument: ActionSender<WrappedInstrument>;
  
    constructor() {
        const [sendState, onReceiveState] = room.makeAction<IInstrumentData[]>("state");
        const [sendInstrument, onReceiveInstrument] = room.makeAction<WrappedInstrument>("instrument");
        this.sendState = sendState;
        this.sendInstrument = sendInstrument;
        onReceiveState((data, peerId) => {
            if (this.host)
                return;
            console.log("receiveState", data, peerId);
            this.instrumentsData.instrumentsData = data;
        });
        onReceiveInstrument((data, peerId) => {
            console.log("receiveInstrument", data, peerId);
            this.instrumentsData.instrumentsData.splice(data.index, 1,data.instrument);
        });
        // this.webrtcProvider.on("synced", x => console.error("synced", x, $state.snapshot(this.synchedStore)));
        // this.webrtcProvider.awareness.on('update', (x:any) => console.log("update awareness", x));
        // this.webrtcProvider.awareness.on('change', (x:any) => console.log("change awareness", x));
        // this.webrtcProvider.on('synced', x => console.error("synced", x, this.doc));
        // this.doc.on('load', x => console.error("loaded", this.doc));
        // this.doc.on('update', x => console.error("updateed", this.doc));

        // this.webrtcProvider.connect();
    }
    init(host: boolean) {
        this.host = host;
        this.preset();
    }
    preset() {
        this.instrumentsData.instrumentsData.push(createInstrument(
            'PianoScale',
            //  notes: [1, 2, 3,undefined,4,5,3,undefined]
        ));
        this.instrumentsData.instrumentsData.push(createInstrument("Drum"));

    }
    setInstrument(index: number, data: IInstrumentData) {
        console.log("setInstrument", index, $state.snapshot(data));
        const snapshot = $state.snapshot(data);
        this.instrumentsData.instrumentsData.splice(index, 1, snapshot);
        this.sendInstrument({index,instrument: snapshot})
    };
    setInstrumentPartial = (index: number, data: Partial<IInstrumentData>) => {

        // this.instrumentsData[index] = Object.assign(this.instrumentsData[index], data);

        this.instrumentsData.instrumentsData[index] = {
            ...this.instrumentsData.instrumentsData[index],
            ...data
        };
        // this.synchedStore.instrumentsData = [...this.synchedStore.instrumentsData];
        console.log("setInstrumentPartial", index, data, $state.snapshot(this.instrumentsData));
    };
    removeInstrument(index: number): any {
        this.instrumentsData.instrumentsData.splice(index, 1);
    }
}

export const store = new AppStore();
room.onPeerJoin(peerId => store.peerJoined(peerId));
room.onPeerLeave(peerId => store.peerLeft(peerId));
