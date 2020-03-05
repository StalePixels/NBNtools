import { log } from "./Logger";
import { Session } from './Session';
import * as path from "path";
import * as fs from "fs";
import { TextEncoder } from "util";

const MAX_FILE_SIZE = 4294967295;

export class PersonalServer {
    private block: number;
    private blockData: Uint8Array;
    private checksum: number;
    private fileHandle: number;
    private remainder: number;
    private retries: number;
    private readonly session: Session;
    private state: string;
    private totalBlocks: number;

    constructor(session: Session) {
        this.session = session;
        this.state = "W"; // WAITING

        log(`PersonalServer created for ${this.session.socket.remoteAddress}:${this.session.socket.remotePort}` );
    }

    public command(cmd: string, params: readonly string[]): void {
        switch (cmd) {
            case "GET":
                this.send(params.join(' '));
                break;
            case "QUIT":
                this.session.end("OK");
                break;
            default:
                this.session.end("BadCommand_ERROR");
        }
    }


    private send(file: string): void {
        this.session.state = "S";       // SENDING file
        this.state = "S";       // SENDING file
        this.block = 0;

        const absFile = path.resolve(this.session.config.FILEPATH+file);

        if(!absFile.startsWith(this.session.config.FILEPATH)) {
            this.session.end("BadPath_ERROR");
            return;
        }

        if (!fs.existsSync(absFile)) {
            this.session.end("BadFile_ERROR");
            return;
        }

        log(`STATING ${file} from "${this.session.config.FILEPATH}" `);

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

        this.totalBlocks = Math.floor(stats.size / 240);
        this.remainder = stats.size % 240;

        log(` Size:\t${stats.size>>24}|${(stats.size>>16)&255}|${(stats.size>>8)&255}|${stats.size&255}\n` +
            ` Blocks:\t${this.totalBlocks>>24}|${(this.totalBlocks>>16)&255}|${(this.totalBlocks>>8)&255}|${this.totalBlocks&255}\n` +
            ` Remainder:\t${this.remainder}\n` +
            ` Filename:\t${filename}`);

        this.checksum = 0;

        fs.open(absFile, 'r',  (err, fd) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            } else {
                this.fileHandle = fd;
                // Send the HEADER
                this.session.socket.write(Uint8Array.from([
                    // Protocol Version    Uint8
                    1,
                    // Size                Uint32
                    (stats.size >> 24), (stats.size >> 16) & 255, (stats.size >> 8) & 255, (stats.size) & 255,
                    // Complete Blocks     Uint32
                    (this.totalBlocks >> 24), (this.totalBlocks >> 16) & 255, (this.totalBlocks >> 8) & 255, (this.totalBlocks) & 255,
                    // Bytes Remaining     Uint8
                    this.remainder
                ]));
                // String <128char     UChar
                this.session.socket.write(filename);

                // Terminating NULL    0x00
                this.session.socket.write(Uint8Array.from([0]));
            }
        });
    }

    public data(buffer: Buffer): void {
        switch(this.state) {
            case "S":     // STREAM data to NBNServer
                if (buffer[0] === 33) {
                    this.block++;
                    this.retries = 0;
                    this.readBlock();
                } else if (buffer[0] === 63) {
                    if(this.retries<3) {
                        this.retries++;
                        this.sendBlock();
                    } else {
                        this.session.end("ExcessRetries_ERROR");
                    }
                }
                break;
            case "C":    // FILE COMPLETE
                if(buffer[0]===33) {
                    this.state = 'W';
                } else if(buffer[0]===63) {
                    this.retries++;
                    this.sendBlock();
                }
                break;
            default:
                break;
        }
    }

    private readBlock(): void {
        this.blockData = new Uint8Array(240);
        this.checksum = 0;
        this.retries = 0;

        let size = 240;

        if(this.block>this.totalBlocks) {
            size = this.remainder;
            this.state = "C";       // We've now COMPLETED reading all the blocks
        }
        // const size = (this.block>this.totalBlocks) ? this.remainder : 240;

        // @ts-ignore
        fs.read(this.fileHandle, this.blockData, 0, size , null,  (err, bytesRead, buffer) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            } else {
                for (let i = 0; i < size; i++) {
                    this.checksum = this.checksum + this.blockData[i];
                }
                this.checksum = this.checksum % 65535;
                this.sendBlock();
            }
        });
    }

    private sendBlock(): void {
        this.session.socket.write(this.blockData.slice(0,(this.block>this.totalBlocks) ? this.remainder : 240));
        this.session.socket.write(Uint8Array.from([this.checksum >> 8, this.checksum & 255]));
    }
}