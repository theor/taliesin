import { createInstrument, getInstrument,  type IInstrumentViewProps, Status, type InstrumentData, Instrument } from "./interfaces";
import { joinRoom } from 'trystero/nostr';
import { selfId, type ActionSender, type JsonValue } from 'trystero'

const config = {
    appId: 'taliesin',
    // relayUrls: ["wss://192.168.1.82:3334"]
}
const room = joinRoom(config, 'room1');

type InstrumentDataJsonValue = InstrumentData & {[key: string]: JsonValue};
type WrappedInstrument = {
    index: number;
    instrument: InstrumentDataJsonValue;
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
    instrumentsData = $state({ instrumentsData: [] as InstrumentData[] });
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
            this.sendState(this.instrumentsData.instrumentsData as InstrumentDataJsonValue[], peerId);
    }
    peerLeft(peerId: string) {
        console.log("peer left", peerId);
    }

    sendState: ActionSender<InstrumentDataJsonValue[]>;
    sendInstrument: ActionSender<WrappedInstrument>;
  
    constructor() {
        const [sendState, onReceiveState] = room.makeAction<InstrumentDataJsonValue[]>("state");
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
    }
    init(host: boolean) {
        this.host = host;
        if(this.instrumentsData.instrumentsData.length === 0)
            this.preset();
    }
    preset() {
        this.instrumentsData.instrumentsData.push(createInstrument(
            'PianoScale',
            //  notes: [1, 2, 3,undefined,4,5,3,undefined]
        ));    
        this.instrumentsData.instrumentsData.push(createInstrument("Drum"));

    }
    createInstrument(name: string) {
        this.instrumentsData.instrumentsData.push(createInstrument(
            name,
            //  notes: [1, 2, 3,undefined,4,5,3,undefined]
        ));
    }
    setInstrument(index: number, data: InstrumentData) {
        console.log("setInstrument", index, $state.snapshot(data));
        const snapshot = $state.snapshot(data);
        this.instrumentsData.instrumentsData.splice(index, 1, snapshot);
        this.sendInstrument({index,instrument: snapshot as InstrumentDataJsonValue})
    };
    setInstrumentPartial = (index: number, data: Partial<InstrumentData>) => {

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
