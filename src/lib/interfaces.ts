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
    
    getCell(data:IInstrumentData,track: string, step: number) : boolean ;
    setCell(data:IInstrumentData,track: string,step: number, value: boolean): void;
    
}
export interface IInstrument{
    name: string;
    generate: (data: IInstrumentData) => string;
    createData: () => IInstrumentData;
    // sequencer(data: IInstrumentData): ISequencer|undefined ;
    sequencer: ISequencer|undefined;

}
export abstract  class Instrument<T extends IInstrumentData> implements IInstrument {
    sequencer: ISequencer | undefined;
    // abstract sequencer(data: IInstrumentData): ISequencer|undefined ;
    notes: string[] = [];;
    name: string = this.constructor.name;
    
    abstract createData_():  Omit<T,'instrumentName'>;
    createData():  T {
const data = this.createData_();
        return { ...data, instrumentName: this.name } as T;
    }
    generate(data: IInstrumentData) : string {
        return this.generate_(data as T);
    }
    protected abstract generate_ (data: T):  string;
}

export interface IInstrumentData {
    instrumentName: string;
}

export interface PianoScaleData extends IInstrumentData {
    notes: (number|undefined)[];
};
export class PianoScale extends Instrument<PianoScaleData> {
    protected generate_(data: PianoScaleData): string {
        return `n("${data.notes.join(' ')}").scale("C2:minor").sound("sawtooth").n(4)`;
    }
    name: string = 'PianoScale';
    // notes = [1,2,3,4,5,6,7].map(x => x.toString());
    createData_() {
        return {notes:[1, 2, 3, 4]};
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
export interface DrumData extends IInstrumentData {
    notes: {[key in DrumNote]: (0|1)[]};
};

class DrumSequencer implements ISequencer {
    tracks(): string[] {
        return Object.values(DrumNote);
    }
    getCell(data:IInstrumentData, track: string, step: number): boolean {
        const trackData = (data as DrumData).notes[track as DrumNote];
        if(!trackData) return false;
        if(step < 0 || step >= trackData.length) return false;
        return trackData[step] == 1;
    }
    setCell(data:IInstrumentData,track: string, step: number, value: boolean): void {
        let trackData = (data as DrumData).notes[track as DrumNote];
        if(!trackData) {
            trackData = new Array(8).fill(0);
        }
        trackData[step] = value ? 1 : 0;
        (data as DrumData).notes[track as DrumNote] = trackData;
    }
}
export class Drum extends Instrument<DrumData> {
    // notes = Object.values(DrumNote);
    // sequencer(data: IInstrumentData): ISequencer|undefined {
    //     return new DrumSequencer(data as DrumData);
    // }
    protected generate_(data: DrumData): string {
        const joined = Object.entries(data.notes).map(t => {
            const [k, v] = t;
            var p = v.map(x =>x == 1 ? k : "~").join(" ");
            return p;
        }).join(",");// `s("${data.notes.join(' ')}")`;
        return `s("${joined}")`;
    }
    name: string = 'Drum';
    /**
     *
     */
    constructor() {
        super();
        this.sequencer = new DrumSequencer();
    }
    createData_() {
        let o = {notes: {}} as DrumData;

        o.notes[DrumNote.kick] = [1,0,0,0,1,0,0,0];
        o.notes[DrumNote.snare] = [0,0,1,0,0,0,1,0];
        o.notes[DrumNote.hiHat] = [1,1,1,1,1,1,1,1];
        return o;
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
export function getInstrument<TD extends IInstrumentData>(data:TD): Instrument<TD> | undefined {
    const instr = instrumentMap[data.instrumentName];
    if (instr) {
        return instr as Instrument<TD>;
    } else {
        console.error("Instrument not found", data);
        return undefined;
        // throw new Error(`Instrument ${name} not found`);
    }
}
export function createInstrument<TD extends IInstrumentData>(d: Partial<TD> & IInstrumentData): TD {
    var instr = instrumentMap[d.instrumentName!] as Instrument<TD>;
    var baseData = instr.createData() as TD;
    if(d)
    {
        var data = { ...baseData, ...d };
        return data;
    }
    else
        return baseData;
} 


export interface IInstrumentViewProps {
    instrumentData: IInstrumentData;
    index: number;
}
// export function castProps<T extends IInstrumentData>(p:IInstrumentData): ITypedInstrumentViewProps<T>{
//     return p as ITypedInstrumentViewProps<T>;
// }
export interface ITypedInstrumentViewProps<T extends IInstrumentData> {
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