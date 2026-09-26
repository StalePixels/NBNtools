import * as fs from "node:fs";
import * as path from "node:path";
import { TextEncoder } from "node:util";
import { log } from "./Logger.js";
import type { Session } from './Session.js';

const MAX_FILE_SIZE = 4294967295;
const DEFAULT_BLOCK_SIZE = 4096;
const DEFAULT_CHECKSUM = 256;
const DEFAULT_DIR_SIZE = 16;
const PROTOCOL_VERSION = 2;

const NBN_COMMAND_ACK = "!".charCodeAt(0);
const NBN_COMMAND_BACK = "<".charCodeAt(0);

function concatTypedArrays(a: Uint8Array, b: ArrayLike<number>): Uint8Array { // a, b TypedArray of same type
    const c = new Uint8Array(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
}

function isInsideRoot(root: string, absPath: string): boolean {
    const base = path.resolve(root);
    const resolved = path.resolve(absPath);
    return resolved === base || resolved.startsWith(base.endsWith(path.sep) ? base : base + path.sep);
}

async function exists(absPath: string): Promise<boolean> {
    try {
        await fs.promises.access(absPath);
        return true;
    } catch {
        return false;
    }
}

export class Server {
    protected block!: number;
    protected blockData!: Uint8Array;
    protected blockSize!: number;
    protected checksum!: number;
    protected checksumBase: number;
    protected fileHandle?: number;
    protected reading?: Promise<void>;
    protected currentWorkingDirectory: string;
    protected preferredBlockSize: number;
    protected preferredDirSize: number;
    protected remainder!: number;
    protected retries!: number;
    protected session: Session;
    protected state: string;
    protected totalBlocks!: number;

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
                this.holdFor(this.sendFile(params.join(' ')));
                break;
            case "DIR":
                this.block = 0;
                this.holdFor(this.sendDir(params));
                break;
            case "CD":
                this.block = 0;
                this.holdFor(this.changeDir(params.join(' ')));
                break;
            case "QUIT":
                this.session.end("OK");
                break;
            case "!":
                break;
            case "<":
                if (this.block > 0) {
                    this.resendBlock();
                }
                break;
            default:
                this.session.end("BadCommand_ERROR");
        }
    }

    // Old clients send "!1" as well as "!" for each block. Only the first "!1",
    //    which acknowledges the header, counts; later ones repeat the "!".
    public data(line: string): void {
        if (line === "!1" && this.block > 0) {
            return;
        }
        if (line.charCodeAt(0) === NBN_COMMAND_ACK) {
            this.acknowledge();
        } else if (line.charCodeAt(0) === NBN_COMMAND_BACK) {
            this.resendBlock();
        }
    }

    protected acknowledge(): void {
        switch(this.state) {
            case "S":     // SERVING file to NBNClient
                this.block++;
                this.retries = 0;
                this.readFileBlock();
                break;
            case "C":    // FILE COMPLETE
                this.closeFile();
                this.session.state = 'W';
                break;
            default:
                break;
        }
    }

    // The session handles its next line only after this work has finished.
    protected holdFor(work: Promise<void>): void {
        const release = this.session.hold();
        work.catch((err: unknown) => {
            log(err);
            this.session.end("ServerException_ERROR");
        }).finally(release);
    }

    protected resendBlock(): void {
        if(this.retries<3) {
            this.retries++;
            this.sendBlock();
        } else {
            this.session.end("ExcessRetries_ERROR");
        }
    }

    protected async sendDir(params: readonly string[] = []): Promise<void> {
        const absPath = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory)+path.sep;

        if (!(await exists(absPath))) {
            this.session.end("BadFile_ERROR");
            return;
        }

        if(!isInsideRoot(this.session.config.FILEPATH, absPath)) {
            this.session.end("BadFile_ERROR");
            return;
        }

        const relPath = absPath.replace(this.session.config.FILEPATH, '');

        log(this.session.config.FILEPATH.length, this.session.config.FILEPATH, absPath.length, absPath);
        const files = await fs.promises.readdir(absPath);
        // Part Zero, check the config, and see if we show hidden folders or not..
        let dirList:  string[] = [];
        if(absPath.length - this.session.config.FILEPATH.length > 1) {
            // cheap and cheerful subdir checking
            dirList[0] = "..";
        }
        if(!this.session.config.SHOWDOTS) {
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

        let listing: Uint8Array = new Uint8Array();
        for (const entry of page) {
            const fileStat = await fs.promises.stat(absPath+entry);
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
        }

        let header: Uint8Array = new Uint8Array();
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

    protected async changeDir(dir: string): Promise<void> {
        const absPath = path.resolve(dir.startsWith('/') ? (this.session.config.FILEPATH + dir) :
            ( this.session.config.FILEPATH + this.currentWorkingDirectory + path.sep + dir )
        ) + path.sep;

        if (!(await exists(absPath))) {
            this.session.socket.write(Uint8Array.from([60, 13, 10]));
            return;
        }

        if(!(await fs.promises.stat(absPath)).isDirectory()) {
            this.session.socket.write(Uint8Array.from([60, 13, 10]));
            return;
        }

        if(!isInsideRoot(this.session.config.FILEPATH, absPath)) {
            this.session.socket.write(Uint8Array.from([60, 13, 10]));
            return;
        }

        this.session.socket.write(Uint8Array.from([33, 13, 10]));

        const relPath = absPath.replace(this.session.config.FILEPATH, '');

        this.currentWorkingDirectory = relPath;

        log(absPath, this.currentWorkingDirectory);
        const files = await fs.promises.readdir(absPath);

        // Part Zero, check the config, and see if we show hidden folders or not..
        let dirList:  string[] = [];
        if(absPath.length - this.session.config.FILEPATH.length > 1) {
            // cheap and cheerful subdir checking
            dirList[0] = "..";
        }
        if(!this.session.config.SHOWDOTS) {
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

        let header: Uint8Array = new Uint8Array();
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

    // The handle is cleared at once so a second call does nothing; the close
    //    itself waits for any read still using it.
    public closeFile(): void {
        const fd = this.fileHandle;
        if (fd === undefined) {
            return;
        }
        this.fileHandle = undefined;
        void (this.reading ?? Promise.resolve()).then(() => {
            fs.close(fd, () => undefined);
        });
    }

    protected async sendFile(file: string): Promise<void> {
        this.closeFile();
        this.block = 0;
        this.blockSize = this.preferredBlockSize;               // Variable blocksize, we shorten the last to fit

        const absFile = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory + file);

        log(absFile);
        if (!isInsideRoot(this.session.config.FILEPATH, absFile)) {
            this.session.socket.write("BadPath_ERROR");
            this.session.socket.write(Uint8Array.from([13, 10]));
            return;
        }

        const stats = await fs.promises.stat(absFile).catch(() => undefined);

        if (stats === undefined || stats.isDirectory()) {
            this.session.socket.write("NoFile_ERROR");
            this.session.socket.write(Uint8Array.from([13, 10]));
            return;
        }

        log(`STATING ${absFile}" `);

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

    protected sendFileDangerous(filename: string, absFile: string, stats: fs.Stats): void {
        this.totalBlocks = Math.floor(stats.size / this.preferredBlockSize);
        this.remainder = stats.size % this.preferredBlockSize;
        this.checksum = 0;

        const release = this.session.hold();
        fs.open(absFile, 'r',  (err, fd) => {
            if (err) {
                this.session.end("ServerException_ERROR");
                release();
            } else if (this.session.socket.destroyed) {
                fs.close(fd, () => undefined);
                release();
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
                this.session.socket.write(Uint8Array.from([0]), () => release());
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

        const fd = this.fileHandle;
        if (fd === undefined) {
            this.session.end("ServerException_ERROR");
            return;
        }
        const release = this.session.hold();
        let readDone!: () => void;
        this.reading = new Promise((resolve) => {
            readDone = resolve;
        });
        fs.read(fd, this.blockData, 0, this.blockSize , null,  (err, bytesRead) => {
            readDone();
            if (this.fileHandle !== fd) {
                release();
            } else if (bytesRead < this.blockSize) {
                this.session.end("ServerException_ERROR");
                release();
            } else if (err) {
                this.session.end("ServerException_ERROR");
                release();
            } else {
                for (let i = 0; i < this.blockSize; i++) {
                    this.checksum = this.checksum + this.blockData[i];
                }
                this.checksum = this.checksum % this.checksumBase;
                this.sendBlock(release);
            }
        });
    }

    protected sendBlock(done?: () => void): void {
        this.session.socket.write(this.blockData.slice(0, this.blockSize));
        this.session.socket.write(Uint8Array.from([this.checksum]), () => done?.());
    }
}