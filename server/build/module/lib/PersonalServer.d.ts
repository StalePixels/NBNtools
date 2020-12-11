/// <reference types="node" />
import { Session } from './Session';
export declare class PersonalServer {
    protected block: number;
    protected blockData: Uint8Array;
    protected blockSize: number;
    protected checksum: number;
    protected checksumBase: number;
    protected fileHandle: number;
    protected currentWorkingDirectory: string;
    protected preferredBlockSize: number;
    protected preferredDirSize: number;
    protected remainder: number;
    protected retries: number;
    protected session: Session;
    protected state: string;
    protected totalBlocks: number;
    constructor(session: Session);
    command(cmd: string, params: readonly string[]): void;
    data(buffer: Buffer): void;
    protected sendDir(params?: readonly string[]): void;
    protected changeDir(dir: string): void;
    protected sendFile(file: string): void;
    protected sendFileDangerous(filename: string, absFile: string, stats: any): void;
    protected readFileBlock(): void;
    protected sendBlock(): void;
}
