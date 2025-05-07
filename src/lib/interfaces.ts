export enum Status {
    disconnected = 'disconnected',
    connecting = 'connecting',
    connected = 'connected',
}

export interface INetwork {
    status: Status;
    id: string;
}