import {  Status } from "./interfaces";
import { joinRoom } from 'trystero/nostr';
import { selfId, type ActionSender, type JsonValue } from 'trystero'
import type { Constructor, Instrument, InstrumentData } from "./instruments";
import { PianoScale } from "./instruments/MonoSynth";
import { Drum } from "./instruments/Drum";
import type { Component } from "svelte";
import { DrumIcon, KeyboardMusic, Music, Piano } from "@lucide/svelte";
import { PartEffects, type InstrumentPart, MonoSequence, PartSteps, PartFilter, PartOctave } from "./parts.svelte";

export const mixerIndex = -1;


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
export const presets: {name:string, instrument: Constructor<Instrument>, parts: InstrumentPart[]}[] = [
    { name: 'Piano',  instrument: PianoScale,parts:[] },
    { name: 'Drum',  instrument: Drum, parts:[] },
    {name: 'Bass', instrument: PianoScale, parts: [
            new PartEffects({reverb: 0.5}),
            new MonoSequence({notes:[1, 2, 3, undefined, 4, 5, 3, undefined]}),
            new PartSteps(8, 2, false),
            new PartOctave(2),
]}
];
class AppStore {
    createInstrumentPreset(preset: { name: string; instrument: Constructor<Instrument>; parts: InstrumentPart[]; }) {
        const { instrument, parts } = preset;
        this.instrumentsData.instrumentsData.push(createInstrument(
            instrument,
            parts,
            preset.name
        ));
    }
    setInstrumentPart(selectedIndex: number, partIndex: number, p: InstrumentPart): void {
        this.instrumentsData.instrumentsData[selectedIndex].parts.splice(partIndex, 1, p);
        this.setInstrument(selectedIndex, this.instrumentsData.instrumentsData[selectedIndex]);
    }
	randomize(index: number) {
		const instr = getInstrument(this.instrumentsData.instrumentsData[index]);
        if (instr) {
            const data = instr.randomize(this.instrumentsData.instrumentsData[index]);
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
            PianoScale,
            [
                new PartEffects({reverb: 1, }),
                new MonoSequence({notes:[1, 2, 3, 0, 4, 5, 3, 0]}),
                new PartSteps(8, 1, false),
                new PartFilter({freq:700}),
            ]
        ));    
        this.instrumentsData.instrumentsData.push(createInstrument(PianoScale, [
            new PartEffects({reverb: 0.5}),
            new MonoSequence({notes:[1, 2, 3, undefined, 4, 5, 3, undefined]}),
            new PartSteps(8, 2, false),
            new PartOctave(2),
        ]));

        this.instrumentsData.instrumentsData.push(createInstrument(Drum, [
            new PartEffects({reverb: 0.2})
        ]));

    }
    createInstrument<T extends Instrument>(name: Constructor<T>) {
        this.instrumentsData.instrumentsData.push(createInstrument(
            name,
            //  notes: [1, 2, 3,undefined,4,5,3,undefined]
        ));
    }
    setInstrument(index: number, data: InstrumentData) {
        // console.log("setInstrument", index, data);
        const snapshot = data;
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


const instrumentMap: { [key: string]: Instrument } = {
    PianoScale: new PianoScale(),
    Drum: new Drum()
  };
  export function getInstrumentIcon(name: string): Component {
    switch (name) {
      case 'PianoScale':
        return KeyboardMusic;
      case 'Drum':
        return DrumIcon;
      default:
        return Music;
    }
  }
  export function getInstrument(data: InstrumentData): Instrument | undefined {
    if (!data) return undefined;
    const instr = instrumentMap[data.instrumentName];
    if (instr) {
      return instr as Instrument;
    } else {
      console.error('Instrument not found', data);
      return undefined;
      // throw new Error(`Instrument ${name} not found`);
    }
  }
  export function createInstrument<TInstr extends Instrument>(
    n: Constructor<TInstr>,
    d?: InstrumentPart[],
    name?: string
  ): InstrumentData {
    console.log('createInstrument', n, d);
    var instr = instrumentMap[n.name];
    var baseData = instr.createData(name);
    if (d) {
        d.forEach((t, index) => {
            let existingPart = baseData.parts.find(p => p instanceof t.constructor);
            if (existingPart) {
                // Update existing part
                existingPart.assign(t);
            } else {
                // Add new part
                baseData.parts.push(t);
            }
        });
      // baseData.parts
      // var data = { ...baseData, ...d };
      // return data;
    }
    // else
    console.warn($state.snapshot(baseData));
    
    return baseData;
  }
