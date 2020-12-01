/// <reference types="node" />
import { Session } from './Session';
export declare class PersonalServer {
    private block;
    private blockData;
    private blockSize;
    private checksum;
    private checksumBase;
    private fileHandle;
    private currentWorkingDirectory;
    private preferredBlockSize;
    private preferredDirSize;
    private remainder;
    private retries;
    private session;
    private state;
    private totalBlocks;
    constructor(session: Session);
    command(cmd: string, params: readonly string[]): void;
    data(buffer: Buffer): void;
    private sendDir;
    private sendFile;
    private readFileBlock;
    private sendBlock;
}
