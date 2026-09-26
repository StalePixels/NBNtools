import * as fs from "node:fs";
import * as path from "node:path";
import { TextEncoder } from "node:util";
import { log } from "./Logger.js";
import { closeWith, type Answer, type Session } from './Session.js';

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
    protected fileHandle?: fs.promises.FileHandle;
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

    public async command(cmd: string, params: readonly string[]): Promise<Answer> {
        log("COMMAND "+cmd+" WITH "+params);
        switch (cmd) {
            case "GET":
                return this.sendFile(params.join(' '));
            case "DIR":
                this.block = 0;
                return this.sendDir(params);
            case "CD":
                this.block = 0;
                return this.changeDir(params.join(' '));
            case "QUIT":
                return closeWith("OK");
            case "!":
                return { bytes: new Uint8Array() };
            case "<":
                if (this.block > 0) {
                    return this.resendBlock();
                }
                return { bytes: new Uint8Array() };
            default:
                return closeWith("BadCommand_ERROR");
        }
    }

    // Old clients send "!1" as well as "!" for each block. Only the first "!1",
    //    which acknowledges the header, counts; later ones repeat the "!".
    public async data(line: string): Promise<Answer> {
        if (line === "!1" && this.block > 0) {
            return { bytes: new Uint8Array() };
        }
        if (line.charCodeAt(0) === NBN_COMMAND_ACK) {
            return this.acknowledge();
        } else if (line.charCodeAt(0) === NBN_COMMAND_BACK) {
            return this.resendBlock();
        }
        return { bytes: new Uint8Array() };
    }

    protected async acknowledge(): Promise<Answer> {
        switch(this.state) {
            case "S":     // SERVING file to NBNClient
                this.block++;
                this.retries = 0;
                return this.readFileBlock();
            case "C":    // FILE COMPLETE
                this.closeFile();
                this.session.state = 'W';
                break;
            default:
                break;
        }
        return { bytes: new Uint8Array() };
    }

    protected resendBlock(): Answer {
        if(this.retries<3) {
            this.retries++;
            return { bytes: this.sendBlock() };
        }
        return closeWith("ExcessRetries_ERROR");
    }

    protected async sendDir(params: readonly string[] = []): Promise<Answer> {
        const absPath = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory)+path.sep;

        if (!(await exists(absPath))) {
            return closeWith("BadFile_ERROR");
        }

        if(!isInsideRoot(this.session.config.FILEPATH, absPath)) {
            return closeWith("BadFile_ERROR");
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

        this.checksum = 0;
        for (const letter of listing) {
            this.checksum = this.checksum + letter;
        }
        this.checksum = this.checksum % this.checksumBase;

        // Send the DIRHEADER, the filenames and the checksum
        return { bytes: concatTypedArrays(concatTypedArrays(header, listing), [this.checksum]) };
    }

    protected async changeDir(dir: string): Promise<Answer> {
        const absPath = path.resolve(dir.startsWith('/') ? (this.session.config.FILEPATH + dir) :
            ( this.session.config.FILEPATH + this.currentWorkingDirectory + path.sep + dir )
        ) + path.sep;

        if (!(await exists(absPath))) {
            return { bytes: Uint8Array.from([60, 13, 10]) };
        }

        if(!(await fs.promises.stat(absPath)).isDirectory()) {
            return { bytes: Uint8Array.from([60, 13, 10]) };
        }

        if(!isInsideRoot(this.session.config.FILEPATH, absPath)) {
            return { bytes: Uint8Array.from([60, 13, 10]) };
        }

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

        // Send "!" and the DIRHEADER
        return { bytes: concatTypedArrays(Uint8Array.from([33, 13, 10]), header) };
    }

    // The handle is cleared at once so a second call does nothing;
    //    FileHandle.close() waits for any read still using it.
    public closeFile(): void {
        const file = this.fileHandle;
        if (file === undefined) {
            return;
        }
        this.fileHandle = undefined;
        file.close().catch(() => undefined);
    }

    protected async sendFile(file: string): Promise<Answer> {
        this.closeFile();
        this.block = 0;
        this.blockSize = this.preferredBlockSize;               // Variable blocksize, we shorten the last to fit

        const absFile = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory + file);

        log(absFile);
        if (!isInsideRoot(this.session.config.FILEPATH, absFile)) {
            return { bytes: new TextEncoder().encode("BadPath_ERROR\r\n") };
        }

        const stats = await fs.promises.stat(absFile).catch(() => undefined);

        if (stats === undefined || stats.isDirectory()) {
            return { bytes: new TextEncoder().encode("NoFile_ERROR\r\n") };
        }

        log(`STATING ${absFile}" `);

        if (stats.size > MAX_FILE_SIZE) {
            return { bytes: new TextEncoder().encode("FileTooBig_ERROR\r\n") };
        }

        const filename = path.basename(absFile);

        if (filename.length > 127) {
            this.state = "Q";        // QUIT
            return closeWith("FilenameTooLong_ERROR");
        }

        this.session.state = "S";                               // Flag in session
        this.state = "S";                                       // Flag in handler
        return this.sendFileDangerous(filename, absFile, stats);
    }

    protected async sendFileDangerous(filename: string, absFile: string, stats: fs.Stats): Promise<Answer> {
        this.totalBlocks = Math.floor(stats.size / this.preferredBlockSize);
        this.remainder = stats.size % this.preferredBlockSize;
        this.checksum = 0;

        const file = await fs.promises.open(absFile, 'r');
        if (this.session.socket.destroyed) {
            await file.close();
            return { bytes: new Uint8Array() };
        }
        this.fileHandle = file;
        // Send the FILEHEADER
        const header = Uint8Array.from([
            // Protocol Version    Uint8
            PROTOCOL_VERSION,
            // Size                Uint32
            (stats.size) & 255, (stats.size >> 8) & 255, (stats.size >> 16) & 255, (stats.size >> 24),          // needs a little indian helper
            // Complete Blocks     Uint32
            (this.totalBlocks) & 255, (this.totalBlocks >> 8) & 255, (this.totalBlocks >> 16) & 255, (this.totalBlocks >> 24), // needs a little indian helper
            // Bytes Remaining     Uint16
            this.remainder & 255, (this.remainder >> 8), // needs a little indian helper
        ]);
        // String <128char     UChar, then Terminating NULL    0x00
        return { bytes: concatTypedArrays(concatTypedArrays(header, new TextEncoder().encode(filename)), [0]) };
    }

    protected async readFileBlock(): Promise<Answer> {
        this.blockData = new Uint8Array(this.blockSize);
        this.checksum = 0;
        this.retries = 0;

        if(this.block>this.totalBlocks) {
            this.blockSize = this.remainder;
            this.state = "C";       // We've now COMPLETED reading all the blocks
        }

        const file = this.fileHandle;
        if (file === undefined) {
            log("No file is open");
            return closeWith("ServerException_ERROR");
        }
        const { bytesRead } = await file.read(this.blockData, 0, this.blockSize, null);
        if (this.fileHandle !== file) {
            return { bytes: new Uint8Array() };
        }
        if (bytesRead < this.blockSize) {
            log(`Short read: ${bytesRead} of ${this.blockSize} bytes`);
            return closeWith("ServerException_ERROR");
        }
        for (let i = 0; i < this.blockSize; i++) {
            this.checksum = this.checksum + this.blockData[i];
        }
        this.checksum = this.checksum % this.checksumBase;
        return { bytes: this.sendBlock() };
    }

    protected sendBlock(): Uint8Array {
        return concatTypedArrays(this.blockData.slice(0, this.blockSize), [this.checksum]);
    }
}