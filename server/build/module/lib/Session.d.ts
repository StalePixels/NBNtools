/// <reference types="node" />
import * as net from 'net';
export declare class Session {
    readonly config: any;
    socket: net.Socket;
    state: string;
    private server;
    constructor(socket: net.Socket, config: any);
    data(buffer: Buffer): void;
    end(message: string): void;
}
