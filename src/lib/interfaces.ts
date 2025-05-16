export enum Status {
    disconnected = 'disconnected',
    connecting = 'connecting',
    connected = 'connected',
}

export interface INetwork {
    status: Status;
    id: string;
}

export class TestNetwork implements INetwork {
    status: Status = Status.disconnected;
    id: string = 'testnet';
    constructor(status: Status = Status.disconnected) {
        this.status = status;
    }
}

export const network: INetwork = new TestNetwork();

export interface IInstrument{
    name: string;
    generate: (data: IInstrumentData) => string;
    createData: () => IInstrumentData;
}
export abstract  class Instrument<T extends IInstrumentData> implements IInstrument {
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
    notes: number[];
};
export class PianoScale extends Instrument<PianoScaleData> {
    protected generate_(data: PianoScaleData): string {
        return `s("bd sd,hh*16")`;
        return `n("${data.notes.join(' ')}").scale("C2:minor").sound("sawtooth").n(4)`;
    }
    name: string = 'PianoScale';
    createData_() {
        return {notes:[1, 2, 3, 4]};
    }
}



const instrumentMap: { [key: string]: IInstrument } = {
    'PianoScale': new PianoScale(),
}
export function getInstrument<TD extends IInstrumentData>(data:TD): Instrument<TD> {
    const instr = instrumentMap[data.instrumentName];
    if (instr) {
        return instr as Instrument<TD>;
    } else {
        throw new Error(`Instrument ${name} not found`);
    }
}
export function createInstrument<TD extends IInstrumentData>(d?: Partial<TD>): TD {
    var instr = instrumentMap['PianoScale'];
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