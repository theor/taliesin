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
}
export abstract  class Instrument<T extends IInstrumentData> implements IInstrument {
    abstract name: string;
    abstract createData():  T;
    // private _data: T;
    // get data(): T { return this._data; }
    // set data(d: T) { this._data = d; }
    generate(data: IInstrumentData) : string {
        return this.generate_(data as T);
    }
    protected abstract generate_ (data: T):  string;
    // constructor(data?: Partial<T>) {
        // this._data = this.createData();
        // if (data) {
            // this._data = {...this._data,...data};
        // }
    // }
}

export interface IInstrumentData {}

export type PianoScaleData = {
    notes: number[];
};

export class PianoScale extends Instrument<PianoScaleData> {
    protected generate_(data: PianoScaleData): string {
        return `n("${data.notes.join(' ')}").scale("C2:minor").sound("sawtooth").n(4)`;
    }
    name: string = 'PianoScale';
    createData(): PianoScaleData {
        return {notes:[1, 2, 3, 4]};
    }
}

export interface IInstrumentViewProps<T extends IInstrumentData> {
    instrumentData: IInstrumentData;
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