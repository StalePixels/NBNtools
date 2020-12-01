import * as fs from "fs";
import * as path from "path";
import { TextEncoder } from "util";
import { log } from "./Logger";
import { Session } from './Session';

const MAX_FILE_SIZE = 4294967295;
const DEFAULT_BLOCK_SIZE = 4096;
const DEFAULT_CHECKSUM = 256;
const DEFAULT_DIR_SIZE = 16;
const PROTOCOL_VERSION = 2;

const NBN_COMMAND_NEXT = "!".charCodeAt(0);
const NBN_COMMAND_BACK = "<".charCodeAt(0);

export class PersonalServer {
    private block: number;
    private blockData: Uint8Array;
    private blockSize: number;
    private checksum: number;
    private checksumBase: number;
    private fileHandle: number;
    private currentWorkingDirectory: string;
    private preferredBlockSize: number;
    private preferredDirSize: number;
    private remainder: number;
    private retries: number;
    private session: Session;
    private state: string;
    private totalBlocks: number;

    constructor(session: Session) {
        this.session = session;
        this.state = "W"; // WAITING
        this.preferredBlockSize = DEFAULT_BLOCK_SIZE;
        this.preferredDirSize = DEFAULT_DIR_SIZE;
        this.checksumBase = DEFAULT_CHECKSUM;
        this.currentWorkingDirectory = ''

        log(`PersonalServer created for ${this.session.socket.remoteAddress}:${this.session.socket.remotePort}` );
    }

    public command(cmd: string, params: readonly string[]): void {
        switch (cmd) {
            case "GET":
                this.sendFile(params.join(' '));
                break;
            case "LS":
            case "CAT":
            case "DIR":
                this.sendDir(parseInt(params[0]));
                break;
            case "QUIT":
                this.session.end("OK");
                break;
            default:
                this.session.end("BadCommand_ERROR");
        }
    }

    public data(buffer: Buffer): void {
        switch(this.state) {
            case "S":     // SERVING file to NBNClient
                if (buffer[0]  === NBN_COMMAND_NEXT) {
                    this.block++;
                    this.retries = 0;
                    this.readFileBlock();
                } else if (buffer[0]  === NBN_COMMAND_BACK) {
                    if(this.retries<3) {
                        this.retries++;
                        this.sendBlock();
                    } else {
                        this.session.end("ExcessRetries_ERROR");
                    }
                }
                break;
            case "C":    // FILE COMPLETE
                if(buffer[0] === NBN_COMMAND_NEXT) {
                    this.session.state = 'W';
                } else if(buffer[0] === NBN_COMMAND_BACK) {
                    this.retries++;
                    this.sendBlock();
                }
                break;
            default:
                break;
        }
    }

    private sendDir(dirPage = 1): void {
        const absPath = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory);

        log(absPath, this.preferredDirSize);
        if (!fs.existsSync(absPath)) {
            this.session.end("BadFile_ERROR");
            return;
        }

        log(`LISTING "${absPath}", Page ${dirPage}`);

        fs.readdir(absPath,  (err, files) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            } else {
                // First, what page did they ask for
                const firstFile = (dirPage - 1) * this.preferredDirSize
                // this.blockData = new Uint8Array(this.blockSize);
                log(files, firstFile);
    //
    //             // Send the DIRHEADER
    //             this.session.socket.write(Uint8Array.from([
    //                 // Protocol Version    Uint8
    //                 PROTOCOL_VERSION,
    //                 // Total Dir Size                Uint16
    //                 (files.length >> 8), (files.length) & 255,
    //                 // Complete Blocks     Uint32
    //                 (this.totalBlocks >> 24), (this.totalBlocks >> 16) & 255, (this.totalBlocks >> 8) & 255, (this.totalBlocks) & 255,
    //                 // Bytes Remaining     Uint16
    //                 (this.remainder >> 8), this.remainder & 255,
    //             ]));
    //
    //             // Terminating NULL    0x00
    //             this.session.socket.write(Uint8Array.from([0]));
            }
        });
    }

    private sendFile(file: string): void {
        this.session.state = "S";                               // Flag in session
        this.state = "S";                                       // Flag in handler
        this.block = 0;
        this.blockSize = this.preferredBlockSize;               // Variable blocksize, we shorten the last to fit

        const absFile = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory + file);

        if(!absFile.startsWith(this.session.config.FILEPATH)) {
            this.session.end("BadPath_ERROR");
            return;
        }

        if (!fs.existsSync(absFile)) {
            this.session.end("BadFile_ERROR");
            return;
        }

        log(`STATING ${absFile}" `);

        const stats = fs.statSync(absFile);

        if(stats.size > MAX_FILE_SIZE) {
            this.session.end("FileTooBig_ERROR");
            return;
        }

        const filename = path.basename(absFile);

        if(filename.length>127) {
            const error = new TextEncoder().encode("FilenameTooLong_ERROR").toString();
            this.session.end(error);
            this.state = "Q";        // QUIT
            return;
        }

        this.totalBlocks = Math.floor(stats.size / this.preferredBlockSize);
        this.remainder = stats.size % this.preferredBlockSize;
        this.checksum = 0;

        log(
            (stats.size) & 255, (stats.size >> 8) & 255, (stats.size >> 16) & 255, (stats.size >> 24),          // needs a little indian helpe
        );
        fs.open(absFile, 'r',  (err, fd) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            } else {
                this.fileHandle = fd;
                // Send the FILEHEADER
                this.session.socket.write(Uint8Array.from([
                    // Protocol Version    Uint8
                    PROTOCOL_VERSION,
                    // Size                Uint32
                    (stats.size) & 255, (stats.size >> 8) & 255, (stats.size >> 16) & 255, (stats.size >> 24),          // needs a little indian helper
                    // Complete Blocks     Uint32
                    (this.totalBlocks) & 255, (this.totalBlocks >> 8) & 255, (this.totalBlocks >> 16) & 255, (this.totalBlocks >> 24), // needs a little indian helper
                    // Bytes Remaining     Uint16
                    this.remainder & 255, (this.remainder >> 8), // needs a little indian helper
                ]));
                // String <128char     UChar
                this.session.socket.write(filename);

                // Terminating NULL    0x00
                this.session.socket.write(Uint8Array.from([0]));
            }
        });
    }

    private readFileBlock(): void {
        this.blockData = new Uint8Array(this.blockSize);
        this.checksum = 0;
        this.retries = 0;

        if(this.block>this.totalBlocks) {
            this.blockSize = this.remainder;
            this.state = "C";       // We've now COMPLETED reading all the blocks
        }

        fs.read(this.fileHandle, this.blockData, 0, this.blockSize , null,  (err, bytesRead) => {
            if (bytesRead < this.blockSize) {
                this.session.end("ServerException_ERROR");
            } else if (err) {
                this.session.end("ServerException_ERROR");
            } else {
                for (let i = 0; i < this.blockSize; i++) {
                    this.checksum = this.checksum + this.blockData[i];
                }
                this.checksum = this.checksum % this.checksumBase;
                this.sendBlock();
            }
        });
    }

    private sendBlock(): void {
        this.session.socket.write(this.blockData.slice(0, this.blockSize));
        this.session.socket.write(Uint8Array.from([this.checksum]));
    }
}