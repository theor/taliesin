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