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
    generate: () => string;
}
export abstract  class Instrument<T> implements IInstrument {
    abstract name: string;
    abstract createData():  T;
    private _data: T;
    get data(): T { return this._data; }
    set data(d: T) { this._data = d; }
    abstract generate ():  string;
    constructor(data?: Partial<T>) {
        this._data = this.createData();
        if (data) {
            this._data = {...this._data,...data};
        }
    }
}

export class PianoScale extends Instrument<{notes: number[]}> {
    name: string = 'PianoScale';
    generate(){
        return `note("${this.data.notes.join(' ')}")`;
    }
    createData(): {notes: number[]} {
        return {notes:[1, 2, 3, 4]};
    }
}

export interface IInstrumentViewProps<T extends IInstrument> {
    instrument: T;
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