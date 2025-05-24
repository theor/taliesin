export enum Status {
    disconnected = 'disconnected',
    connecting = 'connecting',
    connected = 'connected',
}

// export interface INetwork {
//     status: Status;
//     id: string;
// }

// export class TestNetwork implements INetwork {
//     status: Status = Status.disconnected;
//     id: string = 'testnet';
//     constructor(status: Status = Status.disconnected) {
//         this.status = status;
//     }
// }

// export const network: INetwork = new TestNetwork();
export interface ISequencer {
    tracks(): string[];
    
    getCell(data:InstrumentData,track: string, step: number) : boolean ;
    setCell(data:InstrumentData,track: string,step: number, value: boolean): void;
    
}
export interface IInstrument{
    name: string;
    generate: (data: InstrumentData) => string;
    createData: () => InstrumentData;
    // sequencer(data: IInstrumentData): ISequencer|undefined ;
    sequencer: ISequencer|undefined;
    randomize(data: InstrumentData): InstrumentData;

}
// export interface IInstrumentDataOctave extends IInstrumentData{
//     octave: number;
// }
// export function  hasOctave(x:IInstrumentData): x is IInstrumentDataOctave {
//     return "octave" in x;
// }
export abstract  class Instrument
// <T extends InstrumentData>
 implements IInstrument {
    abstract randomize(data: InstrumentData): InstrumentData;
    sequencer: ISequencer | undefined;
    // abstract sequencer(data: InstrumentData): ISequencer|undefined ;
    notes: string[] = [];;
    name: string = this.constructor.name;
    
    abstract createData_():  InstrumentPart[];
    createData(): InstrumentData {
        return { parts: this.createData_(), instrumentName: this.name };
    }
    abstract generate(data: InstrumentData) : string;
}

export interface PartOctave {
    type: 'octave';
    octave: number;
}
interface PartTrackNotes {
    type: 'trackNotes';
    notes:{[key in DrumNote]: (0|1)[]};

}
interface PartNotes {
    type: 'notes';
    notes:(number|undefined)[];

}
type InstrumentPart = PartOctave | PartTrackNotes | PartNotes;
export interface InstrumentData {
    instrumentName: string;
    parts: InstrumentPart[]
}
export function getPart<T extends InstrumentPart>(key: T["type"], data: InstrumentData) : T | undefined{
    return data.parts.find(x => x.type === key) as T;
}
export function hasPart<T extends InstrumentPart>(key: T["type"], data: InstrumentData) : boolean{
    return data.parts.some(x => x.type === key);
}
// export interface IInstrumentData {
//     instrumentName: string;
// }

// export interface PianoScaleData extends IInstrumentData {
//     octave: number;
//     notes: (number|undefined)[];
// };
export class PianoScale extends Instrument {
    public randomize(data: InstrumentData): InstrumentData {
        const part = getPart<PartNotes>('notes', data)!
        const notes = part.notes.map(() => {
			return Math.floor( Math.random() * 7);
		});
        part.notes = notes;
        return data;
    }
    public generate(data: InstrumentData): string {
        const notes = getPart<PartNotes>('notes', data)!;
        const octave = getPart<PartOctave>('octave', data)?.octave ?? 4;
        return `n("${notes.notes.map(x => x ?? "~").join(' ')}").scale("C${octave}:minor").sound("sawtooth").n(4)`;
    }
    name: string = 'PianoScale';
    // notes = [1,2,3,4,5,6,7].map(x => x.toString());
    createData_() {
        return [
                { type: 'octave', octave: 4 },
                { type: 'notes', notes: [1,2,3,undefined,4,5,3,undefined] }
            ] as InstrumentPart[];
    }
    constructor() {
        super();
        this.sequencer = new NoteSequencer();;
    }
}

class NoteSequencer implements ISequencer {
    tracks(): string[] {
        return [0,1,2,3,4,5,6,7].map(x => x.toString());
    }
    getCell(data: InstrumentData, track: string, step: number): boolean {
        const trackNotes = getPart<PartNotes>('notes', data);
        if (!trackNotes || step < 0 || step >= trackNotes.notes.length) return false;
        return trackNotes.notes[step] == parseInt(track);
    }
    setCell(data: InstrumentData, track: string, step: number, value: boolean): void {
        const trackNotes = getPart<PartNotes>('notes', data);
        if (!trackNotes || step < 0 || step >= trackNotes.notes.length) return;
        trackNotes.notes[step] = value ? parseInt(track) : undefined;
    }
}

export enum DrumNote {
    kick = 'bd',
    snare = 'sd',
    hiHat = 'hh',
    clap = 'cp',
    crash = 'cr',
    ride = 'rd',
    highTom = 'ht',
    medTom = 'mt',
    lowTom = 'lt',
}
// export interface DrumData extends IInstrumentData {
//     notes: {[key in DrumNote]: (0|1)[]};
// };

class DrumSequencer implements ISequencer {
    tracks(): string[] {
        return Object.values(DrumNote);
    }
    getCell(data:InstrumentData, track: string, step: number): boolean {
        const trackNotes = getPart<PartTrackNotes>('trackNotes', data);
        if(!trackNotes) return false;
        const trackData = trackNotes.notes[track as DrumNote];
        if(!trackData) return false;
        if(step < 0 || step >= trackData.length) return false;
        return trackData[step] == 1;
    }
    setCell(data:InstrumentData,track: string, step: number, value: boolean): void {
        const trackNotes = getPart<PartTrackNotes>('trackNotes', data);
        if(!trackNotes) return;
        let trackData = trackNotes.notes[track as DrumNote];
        if(!trackData) {
            trackData = new Array(8).fill(0);
        }
        trackData[step] = value ? 1 : 0;
        trackNotes.notes[track as DrumNote] = trackData;
    }
}
export class Drum extends Instrument {
    public randomize(data: InstrumentData): InstrumentData {
        return data;
    }
    public generate(data: InstrumentData): string {
        const notes = getPart<PartTrackNotes>('trackNotes', data)!;
        const joined = Object.entries(notes.notes).map(t => {
            const [k, v] = t;
            var p = v.map(x =>x == 1 ? k : "~").join(" ");
            return p;
        }).join(",");// `s("${data.notes.join(' ')}")`;
        return `s("${joined}")`;
    }
    name: string = 'Drum';
    constructor() {
        super();
        this.sequencer = new DrumSequencer();
    }
    createData_() {
        let o = {notes: {}} as {notes:{[key in DrumNote]: (0|1)[]}};

        o.notes[DrumNote.kick] = [1,0,0,0,1,0,0,0];
        o.notes[DrumNote.snare] = [0,0,1,0,0,0,1,0];
        o.notes[DrumNote.hiHat] = [1,1,1,1,1,1,1,1];
        return [
            { type: 'trackNotes', notes: o.notes }
        ] as InstrumentPart[];
        // return {notes:[
            // [DrumNote.kick,DrumNote.hiHat],
            // [DrumNote.hiHat],
            // [DrumNote.snare, DrumNote.hiHat],
            // [DrumNote.hiHat],
            // [DrumNote.kick,DrumNote.hiHat],
            // [DrumNote.hiHat],
            // [DrumNote.snare, DrumNote.hiHat],
            // [DrumNote.hiHat],
            // ]};
    }
}



const instrumentMap: { [key: string]: IInstrument } = {
    PianoScale: new PianoScale(),
    Drum: new Drum(),
}
export function getInstrument(data:InstrumentData): Instrument| undefined {
    if(!data)
        return undefined;
    const instr = instrumentMap[data.instrumentName];
    if (instr) {
        return instr as Instrument;
    } else {
        console.error("Instrument not found", data);
        return undefined;
        // throw new Error(`Instrument ${name} not found`);
    }
}
export function createInstrument(n: Instrument["name"], d?: Partial<InstrumentPart>[]): InstrumentData {
    var instr = instrumentMap[n];
    var baseData = instr.createData();
    if(d)
    {
        console.error("not implemented yet", n);
        // baseData.parts
        // var data = { ...baseData, ...d };
        // return data;
    }
    // else
        return baseData;
} 


export interface IInstrumentViewProps {
    instrumentData: InstrumentData;
    index: number;
}
// export function castProps<T extends IInstrumentData>(p:IInstrumentData): ITypedInstrumentViewProps<T>{
//     return p as ITypedInstrumentViewProps<T>;
// }
export interface ITypedInstrumentViewProps<T extends InstrumentData> {
    instrumentData: T;
    index: number;
}
// interface IInstrumentView<T extends IInstrument> {
//     getInstrument(): T;
//     setInstrument(instrument: T): void;
    
//     // onChange: (instrument: T) => void;
//     // onDelete: (instrument: T) => void;
//     // onAdd: (instrument: T) => void;
//     // onPlay: (instrument: T) => void;
//     // onStop: (instrument: T) => void;
// }

// class PianoScaleView implements IInstrumentView<PianoScale> {
//     instrument: PianoScale;
//     constructor(instrument: PianoScale) {
//         this.instrument = instrument;
//     }
// }