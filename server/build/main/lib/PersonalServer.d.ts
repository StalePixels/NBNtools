/// <reference types="node" />
import { Session } from './Session';
export declare class PersonalServer {
    private block;
    private blockData;
    private checksum;
    private fileHandle;
    private remainder;
    private retries;
    private readonly session;
    private state;
    private totalBlocks;
    constructor(session: Session);
    command(cmd: string, params: readonly string[]): void;
    private send;
    data(buffer: Buffer): void;
    private readBlock;
    private sendBlock;
}
