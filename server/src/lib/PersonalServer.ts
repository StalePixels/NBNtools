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

// tslint:disable-next-line:typedef
function concatTypedArrays(a, b) { // a, b TypedArray of same type
    const c = new (a.constructor)(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
}

export class PersonalServer {
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

    constructor(session: Session) {
        this.session = session;
        this.state = "W"; // WAITING
        this.preferredBlockSize = DEFAULT_BLOCK_SIZE;
        this.preferredDirSize = DEFAULT_DIR_SIZE;
        this.checksumBase = DEFAULT_CHECKSUM;
        this.currentWorkingDirectory = '/'

        log(`PersonalServer created for ${this.session.socket.remoteAddress}:${this.session.socket.remotePort}` );
    }

    public command(cmd: string, params: readonly string[]): void {
        log("COMMAND "+cmd+" WITH "+params);
        switch (cmd) {
            case "GET":
                this.sendFile(params.join(' '));
                break;
            case "DIR":
                this.sendDir(params);
                break;
            case "CD":
                this.changeDir(params.join(' '));
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

    protected sendDir(params: readonly string[] = []): void {
        const absPath = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory)+path.sep;

        if (!fs.existsSync(absPath)) {
            this.session.end("BadFile_ERROR");
            return;
        }

        if(!absPath.startsWith(this.session.config.FILEPATH)) {
            this.session.end("BadFile_ERROR");
            return;
        }

        const relPath = absPath.replace(this.session.config.FILEPATH, '');

        log(this.session.config.FILEPATH.length, this.session.config.FILEPATH, absPath.length, absPath);
        fs.readdir(absPath,  (err, files) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            } else {
                // Part Zero, check the config, and see if we show hidden folders or not..
                // @ts-ignore: readonly-array
                let dirList:  string[] = [];
                if(absPath.length - this.session.config.FILEPATH.length > 1) {
                    // cheap and cheerful subdir checking
                    dirList[0] = "..";
                }
                if(this.session.config.SHOWDOTS === false) {
                    files.forEach((file) => {
                        if(!file.startsWith(".")) {
                            dirList.push(file);
                        }
                    });
                } else {
                    dirList = dirList.concat(files);
                }

                // First, what page did they ask for
                let dirPage = parseInt(params[0], 10);
                if (!dirPage) {
                    dirPage = 1;
                }
                const directoryOffset = (dirPage - 1) * this.preferredDirSize
                const totalPages = Math.ceil(dirList.length / this.preferredDirSize );
                const page = dirList.slice(directoryOffset, directoryOffset+this.preferredDirSize);

                let listing = new Uint8Array();
                page.forEach( (entry) => {
                    const fileStat = fs.statSync(absPath+entry);
                    const filesize = fileStat.size;
                    const filetype = fileStat.isDirectory() ? 0 : 1;

                    // Current File Size                Uint32
                    listing = concatTypedArrays(listing, [(filesize) & 255,
                        (filesize >> 8) & 255, (filesize >> 16) & 255, (filesize >> 24) & 255]);

                    // Current File Type                Uint8
                    listing = concatTypedArrays(listing, [filetype]);
                    const entryArray = new TextEncoder().encode(entry);
                    listing = concatTypedArrays(listing, entryArray)
                    listing = concatTypedArrays(listing, [0]);
                });

                let header = new Uint8Array();
                // VER                                  Uint8 (<=63)
                header = concatTypedArrays(header, [PROTOCOL_VERSION]);

                // Path                                 NULL terminated string
                header = concatTypedArrays(header, new TextEncoder().encode(relPath));
                header = concatTypedArrays(header, [0]);

                // Total Entries in this dir            Uint16
                header = concatTypedArrays(header, [(dirList.length) & 255, (dirList.length >> 8)]);

                // Current Page Number                  Uint16
                header = concatTypedArrays(header, [(dirPage) & 255, (dirPage >> 8) & 255]);

                // Current Page Size                    Uint8
                header = concatTypedArrays(header, [page.length]);

                // Total Pages in the dir               Uint16
                header = concatTypedArrays(header, [(totalPages) & 255, (totalPages >> 8)]);

                // Size of NBNBlock                     Uint16
                header = concatTypedArrays(header, [(listing.length) & 255, (listing.length >> 8)]);

                // Send the DIRHEADER
                this.session.socket.write(header);

                // Send the filenames

                this.session.socket.write(listing);
                this.checksum = 0;
                for (const letter of listing) {
                    this.checksum = this.checksum + letter;
                }
                this.checksum = this.checksum % this.checksumBase;
                this.session.socket.write(Uint8Array.from([this.checksum]));
            }
        });
    }

    protected changeDir(dir: string): void {
        const absPath = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory + path.sep + dir)+path.sep;

        if (!fs.existsSync(absPath)) {
            this.session.socket.write(Uint8Array.from([60, 13, 10]));
            return;
        }

        if(!fs.statSync(absPath).isDirectory()) {
            this.session.socket.write(Uint8Array.from([60, 13, 10]));
            return;
        }

        if(!absPath.startsWith(this.session.config.FILEPATH)) {
            this.session.socket.write(Uint8Array.from([60, 13, 10]));
            return;
        }

        this.session.socket.write(Uint8Array.from([33, 13, 10]));

        const relPath = absPath.replace(this.session.config.FILEPATH, '');

        this.currentWorkingDirectory = relPath;

        log(absPath, this.currentWorkingDirectory);
        fs.readdir(absPath,  (err, files) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            } else {

                // Part Zero, check the config, and see if we show hidden folders or not..
                // @ts-ignore: readonly-array
                let dirList:  string[] = [];
                if(absPath.length - this.session.config.FILEPATH.length > 1) {
                    // cheap and cheerful subdir checking
                    dirList[0] = "..";
                }
                if(this.session.config.SHOWDOTS === false) {
                    files.forEach((file) => {
                        if(!file.startsWith(".")) {
                            dirList.push(file);
                        }
                    });
                } else {
                    dirList = dirList.concat(files);
                }

                // First, what page did they ask for
                const dirPage = 1;
                const directoryOffset = (dirPage - 1) * this.preferredDirSize
                const totalPages = Math.ceil(files.length / this.preferredDirSize );
                const page = files.slice(directoryOffset, directoryOffset+this.preferredDirSize);

                let header = new Uint8Array();
                // VER                                  Uint8 (<=63)
                header = concatTypedArrays(header, [PROTOCOL_VERSION]);

                // Path                                 NULL terminated string
                header = concatTypedArrays(header, new TextEncoder().encode(this.currentWorkingDirectory));
                header = concatTypedArrays(header, [0]);

                // Total Entries in this dir            Uint16
                header = concatTypedArrays(header, [(files.length) & 255, (files.length >> 8)]);

                // Current Page Number                  Uint16
                header = concatTypedArrays(header, [(dirPage) & 255, (dirPage >> 8) & 255]);

                // Current Page Size                    Uint8
                header = concatTypedArrays(header, [page.length]);

                // Total Pages in the dir               Uint16
                header = concatTypedArrays(header, [(totalPages) & 255, (totalPages >> 8)]);

                // Send the DIRHEADER
                this.session.socket.write(header);

            }
        });
    }

    protected sendFile(file: string): void {
        this.block = 0;
        this.blockSize = this.preferredBlockSize;               // Variable blocksize, we shorten the last to fit

        const absFile = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory + file);

        log(absFile);
        if (!absFile.startsWith(this.session.config.FILEPATH)) {
            this.session.socket.write("BadPath_ERROR");
            this.session.socket.write(Uint8Array.from([13, 10]));
            return;
        }

        if (!fs.existsSync(absFile) || fs.statSync(absFile).isDirectory()) {
            this.session.socket.write("NoFile_ERROR");
            this.session.socket.write(Uint8Array.from([13, 10]));
            return;
        }

        log(`STATING ${absFile}" `);

        const stats = fs.statSync(absFile);

        if (stats.size > MAX_FILE_SIZE) {
            this.session.socket.write("FileTooBig_ERROR");
            this.session.socket.write(Uint8Array.from([13, 10]));
            return;
        }

        const filename = path.basename(absFile);

        if (filename.length > 127) {
            this.session.end("FilenameTooLong_ERROR");
            this.state = "Q";        // QUIT
            return;
        }

        this.session.state = "S";                               // Flag in session
        this.state = "S";                                       // Flag in handler
        this.sendFileDangerous(filename, absFile, stats);
    }

    protected sendFileDangerous(filename: string, absFile: string, stats: any): void {
        this.totalBlocks = Math.floor(stats.size / this.preferredBlockSize);
        this.remainder = stats.size % this.preferredBlockSize;
        this.checksum = 0;

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

    protected readFileBlock(): void {
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

    protected sendBlock(): void {
        this.session.socket.write(this.blockData.slice(0, this.blockSize));
        this.session.socket.write(Uint8Array.from([this.checksum]));
    }
}