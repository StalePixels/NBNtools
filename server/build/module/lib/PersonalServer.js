import * as fs from "fs";
import * as path from "path";
import { TextEncoder } from "util";
import { log } from "./Logger";
const MAX_FILE_SIZE = 4294967295;
const DEFAULT_BLOCK_SIZE = 4096;
const DEFAULT_CHECKSUM = 256;
const DEFAULT_DIR_SIZE = 16;
const PROTOCOL_VERSION = 2;
const NBN_COMMAND_NEXT = "!".charCodeAt(0);
const NBN_COMMAND_BACK = "<".charCodeAt(0);
export class PersonalServer {
    constructor(session) {
        this.session = session;
        this.state = "W"; // WAITING
        this.preferredBlockSize = DEFAULT_BLOCK_SIZE;
        this.preferredDirSize = DEFAULT_DIR_SIZE;
        this.checksumBase = DEFAULT_CHECKSUM;
        this.currentWorkingDirectory = '';
        log(`PersonalServer created for ${this.session.socket.remoteAddress}:${this.session.socket.remotePort}`);
    }
    command(cmd, params) {
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
    data(buffer) {
        switch (this.state) {
            case "S": // SERVING file to NBNClient
                if (buffer[0] === NBN_COMMAND_NEXT) {
                    this.block++;
                    this.retries = 0;
                    this.readFileBlock();
                }
                else if (buffer[0] === NBN_COMMAND_BACK) {
                    if (this.retries < 3) {
                        this.retries++;
                        this.sendBlock();
                    }
                    else {
                        this.session.end("ExcessRetries_ERROR");
                    }
                }
                break;
            case "C": // FILE COMPLETE
                if (buffer[0] === NBN_COMMAND_NEXT) {
                    this.session.state = 'W';
                }
                else if (buffer[0] === NBN_COMMAND_BACK) {
                    this.retries++;
                    this.sendBlock();
                }
                break;
            default:
                break;
        }
    }
    sendDir(dirPage = 1) {
        const absPath = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory);
        log(absPath, this.preferredDirSize);
        if (!fs.existsSync(absPath)) {
            this.session.end("BadFile_ERROR");
            return;
        }
        log(`LISTING "${absPath}", Page ${dirPage}`);
        fs.readdir(absPath, (err, files) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            }
            else {
                // First, what page did they ask for
                const firstFile = (dirPage - 1) * this.preferredDirSize;
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
    sendFile(file) {
        this.session.state = "S"; // Flag in session
        this.state = "S"; // Flag in handler
        this.block = 0;
        this.blockSize = this.preferredBlockSize; // Variable blocksize, we shorten the last to fit
        const absFile = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory + file);
        if (!absFile.startsWith(this.session.config.FILEPATH)) {
            this.session.end("BadPath_ERROR");
            return;
        }
        if (!fs.existsSync(absFile)) {
            this.session.end("BadFile_ERROR");
            return;
        }
        log(`STATING ${absFile}" `);
        const stats = fs.statSync(absFile);
        if (stats.size > MAX_FILE_SIZE) {
            this.session.end("FileTooBig_ERROR");
            return;
        }
        const filename = path.basename(absFile);
        if (filename.length > 127) {
            const error = new TextEncoder().encode("FilenameTooLong_ERROR").toString();
            this.session.end(error);
            this.state = "Q"; // QUIT
            return;
        }
        this.totalBlocks = Math.floor(stats.size / this.preferredBlockSize);
        this.remainder = stats.size % this.preferredBlockSize;
        this.checksum = 0;
        log((stats.size) & 255, (stats.size >> 8) & 255, (stats.size >> 16) & 255, (stats.size >> 24));
        fs.open(absFile, 'r', (err, fd) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            }
            else {
                this.fileHandle = fd;
                // Send the FILEHEADER
                this.session.socket.write(Uint8Array.from([
                    // Protocol Version    Uint8
                    PROTOCOL_VERSION,
                    // Size                Uint32
                    (stats.size) & 255, (stats.size >> 8) & 255, (stats.size >> 16) & 255, (stats.size >> 24),
                    // Complete Blocks     Uint32
                    (this.totalBlocks) & 255, (this.totalBlocks >> 8) & 255, (this.totalBlocks >> 16) & 255, (this.totalBlocks >> 24),
                    // Bytes Remaining     Uint16
                    this.remainder & 255, (this.remainder >> 8),
                ]));
                // String <128char     UChar
                this.session.socket.write(filename);
                // Terminating NULL    0x00
                this.session.socket.write(Uint8Array.from([0]));
            }
        });
    }
    readFileBlock() {
        this.blockData = new Uint8Array(this.blockSize);
        this.checksum = 0;
        this.retries = 0;
        if (this.block > this.totalBlocks) {
            this.blockSize = this.remainder;
            this.state = "C"; // We've now COMPLETED reading all the blocks
        }
        fs.read(this.fileHandle, this.blockData, 0, this.blockSize, null, (err, bytesRead) => {
            if (bytesRead < this.blockSize) {
                this.session.end("ServerException_ERROR");
            }
            else if (err) {
                this.session.end("ServerException_ERROR");
            }
            else {
                for (let i = 0; i < this.blockSize; i++) {
                    this.checksum = this.checksum + this.blockData[i];
                }
                this.checksum = this.checksum % this.checksumBase;
                this.sendBlock();
            }
        });
    }
    sendBlock() {
        this.session.socket.write(this.blockData.slice(0, this.blockSize));
        this.session.socket.write(Uint8Array.from([this.checksum]));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGVyc29uYWxTZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvbGliL1BlcnNvbmFsU2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQzdCLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDbkMsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQixNQUFNLGFBQWEsR0FBRyxVQUFVLENBQUM7QUFDakMsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUM7QUFDaEMsTUFBTSxnQkFBZ0IsR0FBRyxHQUFHLENBQUM7QUFDN0IsTUFBTSxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7QUFDNUIsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7QUFFM0IsTUFBTSxnQkFBZ0IsR0FBRyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzNDLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUUzQyxNQUFNLE9BQU8sY0FBYztJQWdCdkIsWUFBWSxPQUFnQjtRQUN4QixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFDLFVBQVU7UUFDNUIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLGtCQUFrQixDQUFDO1FBQzdDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQztRQUN6QyxJQUFJLENBQUMsWUFBWSxHQUFHLGdCQUFnQixDQUFDO1FBQ3JDLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxFQUFFLENBQUE7UUFFakMsR0FBRyxDQUFDLDhCQUE4QixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxhQUFhLElBQUks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Q0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUNyRDtnQkFDRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztnQkFDbEQsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2FBQ3BCO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRU8sU0FBUztRQUNiLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDbkUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2hFLENBQUM7Q0FDSiJ9