import * as fs from 'node:fs';
import * as path from 'node:path';
import { log } from './lib/Logger.js';
import { isInsideRoot, MAX_FILE_SIZE, Server } from './lib/Server.js';
import { closeWith, type Answer } from './lib/Session.js';

const OK = Uint8Array.from([33, 13, 10]);       // "!\r\n"
const FAIL = Uint8Array.from([60, 13, 10]);     // "<\r\n"

function isPathError(err: unknown): boolean {
    const code = err instanceof Error && 'code' in err ? err.code : undefined;
    return code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR' || code === 'EEXIST';
}

// The PersonalServer is for one person on a home network, so clients can
//    write too. PUT sends a file to the server, and MKDIR makes a folder.
export class PersonalServer extends Server {
    public override async command(cmd: string, params: readonly string[]): Promise<Answer> {
        switch (cmd) {
            case "PUT":
                return this.receiveFile(params);
            case "MKDIR":
                return this.makeDir(params.join(' '));
            default:
                return super.command(cmd, params);
        }
    }

    // Names that start with "/" count from the top of FILEPATH, as with CD.
    protected resolvePath(name: string): string {
        return path.resolve(name.startsWith('/') ? (this.session.config.FILEPATH + name) :
            (this.session.config.FILEPATH + this.currentWorkingDirectory + path.sep + name));
    }

    protected async makeDir(dir: string): Promise<Answer> {
        if (dir === '') {
            return this.badCommand();
        }
        const absPath = this.resolvePath(dir);
        if (!isInsideRoot(this.session.config.FILEPATH, absPath)) {
            return { bytes: FAIL };
        }
        try {
            await fs.promises.mkdir(absPath, { recursive: true });
        } catch (err) {
            if (isPathError(err)) {
                return { bytes: FAIL };
            }
            throw err;
        }
        return { bytes: OK };
    }

    // "PUT <size> <name>". The blocks are the same as for GET: full blocks of
    //    the block size, then one last block with the rest, which can be empty.
    //    A checksum byte follows each block.
    protected async receiveFile(params: readonly string[]): Promise<Answer> {
        this.closeFile();
        const sizeText = params[0] ?? '';
        const name = params.slice(1).join(' ');
        if (!/^\d+$/.test(sizeText) || name === '') {
            return this.badCommand();
        }
        const size = Number(sizeText);
        if (size > MAX_FILE_SIZE) {
            return { bytes: FAIL };
        }

        const absFile = this.resolvePath(name);
        if (!isInsideRoot(this.session.config.FILEPATH, absFile)) {
            return { bytes: FAIL };
        }

        let file: fs.promises.FileHandle;
        try {
            file = await fs.promises.open(absFile, 'w');
        } catch (err) {
            if (isPathError(err)) {
                return { bytes: FAIL };
            }
            throw err;
        }
        if (this.session.socket.destroyed) {
            await file.close();
            return { bytes: new Uint8Array() };
        }
        log(`RECEIVING ${absFile}, ${size} bytes`);

        this.fileHandle = file;
        this.blockSize = this.preferredBlockSize;
        this.totalBlocks = Math.floor(size / this.blockSize);
        this.remainder = size % this.blockSize;
        this.block = 1;
        this.retries = 0;
        this.receiveNextBlock();
        return { bytes: OK };
    }

    protected receiveNextBlock(): void {
        const length = this.block > this.totalBlocks ? this.remainder : this.blockSize;
        this.session.receive(length + 1, (bytes) => this.receiveBlock(bytes));
    }

    // Answers "!" for a good block, or "<" to have the client send it again.
    protected async receiveBlock(bytes: Uint8Array): Promise<Answer> {
        const file = this.fileHandle;
        if (file === undefined) {
            return closeWith("ServerException_ERROR");
        }
        const data = bytes.subarray(0, bytes.length - 1);
        let checksum = 0;
        for (const byte of data) {
            checksum = checksum + byte;
        }
        if (checksum % this.checksumBase !== bytes[bytes.length - 1]) {
            if (this.retries >= 3) {
                return closeWith("ExcessRetries_ERROR");
            }
            this.retries++;
            this.receiveNextBlock();
            return { bytes: FAIL };
        }

        await file.write(data);
        if (this.fileHandle !== file) {
            return { bytes: new Uint8Array() };
        }
        this.retries = 0;

        if (this.block > this.totalBlocks) {
            this.fileHandle = undefined;
            await file.close();
            return { bytes: OK };
        }
        this.block++;
        this.receiveNextBlock();
        return { bytes: OK };
    }
}
