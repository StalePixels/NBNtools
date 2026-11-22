import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { mock, type TestContext } from 'node:test';
import { PersonalServer, Session, type Config, type ServerClass } from '../build/index.js';

const READ_TIMEOUT_MS = 2000;

export const BLOCK_SIZE = 4096;

export function checksum(bytes: Uint8Array): number {
    let sum = 0;
    for (const byte of bytes) {
        sum = sum + byte;
    }
    return sum % 256;
}

// A public folder of its own for each test, removed when the test ends
export function makeRoot(): string {
    return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nbn-test-')));
}

export function removeRoot(root: string): void {
    fs.rmSync(root, { recursive: true, force: true });
}

export interface TestServer {
    port: number;
    close(): Promise<void>;
}

export interface ServerOptions {
    showDots?: boolean;
    serverClass?: ServerClass;
}

// A server on a free port of 127.0.0.1, serving `root`. PersonalServer when
//    no class is given.
export async function startTestServer(root: string, options: ServerOptions = {}): Promise<TestServer> {
    const config: Config = {
        BACKLOG: 16,
        FILEPATH: root,
        IP: '127.0.0.1',
        PORT: 0,
        RETRY: 1000,
        SHOWDOTS: options.showDots ?? false,
    };
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        new Session(socket, config, options.serverClass ?? PersonalServer);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
        throw new Error('no port');
    }
    return {
        port: address.port,
        close: () => new Promise<void>((resolve) => {
            for (const socket of sockets) {
                socket.destroy();
            }
            server.close(() => resolve());
        }),
    };
}

// Talks to the server as the NBNtools clients do: each command line ends
//    LF then CR, as in clients/common/nbn.c.
export class Client {
    private socket: net.Socket;
    private input: Buffer = Buffer.alloc(0);
    private waiting?: () => void;
    public closed: Promise<void>;

    private constructor(socket: net.Socket) {
        this.socket = socket;
        socket.on('data', (data) => {
            this.input = Buffer.concat([this.input, data]);
            this.waiting?.();
        });
        this.closed = new Promise((resolve) => socket.on('close', () => {
            this.waiting?.();
            resolve();
        }));
    }

    public static async connect(port: number): Promise<Client> {
        const socket = net.connect(port, '127.0.0.1');
        await new Promise<void>((resolve, reject) => {
            socket.once('connect', resolve);
            socket.once('error', reject);
        });
        return new Client(socket);
    }

    public command(line: string): void {
        this.socket.write(`${line}\n\r`);
    }

    public write(bytes: Uint8Array | string): void {
        this.socket.write(bytes);
    }

    // Exactly `count` bytes. Fails when they do not come in time.
    public async read(count: number): Promise<Buffer> {
        const deadline = Date.now() + READ_TIMEOUT_MS;
        while (this.input.length < count) {
            if (this.socket.destroyed || Date.now() > deadline) {
                throw new Error(`wanted ${count} bytes, got ${this.input.length}: ${JSON.stringify(this.input.toString('latin1'))}`);
            }
            await new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, deadline - Date.now());
                this.waiting = () => {
                    clearTimeout(timer);
                    resolve();
                };
            });
            this.waiting = undefined;
        }
        const bytes = this.input.subarray(0, count);
        this.input = this.input.subarray(count);
        return bytes;
    }

    public async readText(count: number): Promise<string> {
        return (await this.read(count)).toString('latin1');
    }

    // A NULL terminated string, without the NULL
    public async readString(): Promise<string> {
        const bytes: number[] = [];
        for (;;) {
            const [byte] = await this.read(1);
            if (byte === 0) {
                return Buffer.from(bytes).toString('latin1');
            }
            bytes.push(byte);
        }
    }

    // Everything the server sends until it closes the connection
    public async readToClose(): Promise<string> {
        await Promise.race([this.closed, new Promise((resolve) => setTimeout(resolve, READ_TIMEOUT_MS))]);
        const text = this.input.toString('latin1');
        this.input = Buffer.alloc(0);
        return text;
    }

    public isClosed(): boolean {
        return this.socket.destroyed || this.socket.readableEnded;
    }

    public destroy(): void {
        this.socket.destroy();
    }
}

export interface FileHeader {
    version: number;
    size: number;
    blocks: number;
    remainder: number;
    name: string;
}

export async function readFileHeader(client: Client): Promise<FileHeader> {
    const fixed = await client.read(11);
    return {
        version: fixed[0],
        size: fixed.readUInt32LE(1),
        blocks: fixed.readUInt32LE(5),
        remainder: fixed.readUInt16LE(9),
        name: await client.readString(),
    };
}

// GET as nbnget does it: one "!" per item, the header first
export async function getFile(client: Client, name: string): Promise<Buffer> {
    client.command(`GET ${name}`);
    const header = await readFileHeader(client);
    const parts: Buffer[] = [];
    for (let block = 1; block <= header.blocks + 1; block++) {
        client.command('!');
        const length = block > header.blocks ? header.remainder : BLOCK_SIZE;
        const data = Buffer.from(await client.read(length));
        const [sum] = await client.read(1);
        if (sum !== checksum(data)) {
            throw new Error(`bad checksum on block ${block}`);
        }
        parts.push(data);
    }
    client.command('!');
    return Buffer.concat(parts);
}

// PUT as the README describes it. Returns the server's first answer when it
//    refuses the file, or "ok".
export async function putFile(client: Client, name: string, data: Uint8Array): Promise<string> {
    client.write(`PUT ${data.length} ${name}\r\n`);
    const answer = await client.readText(3);
    if (answer !== '!\r\n') {
        return answer;
    }
    const blocks = Math.floor(data.length / BLOCK_SIZE);
    for (let block = 0; block <= blocks; block++) {
        const part = data.subarray(block * BLOCK_SIZE, block < blocks ? (block + 1) * BLOCK_SIZE : data.length);
        client.write(Buffer.concat([part, Uint8Array.from([checksum(part)])]));
        const reply = await client.readText(3);
        if (reply !== '!\r\n') {
            throw new Error(`block ${block}: ${JSON.stringify(reply)}`);
        }
    }
    return 'ok';
}

export interface DirEntry {
    size: number;
    type: number;
    name: string;
}

export interface DirHeader {
    version: number;
    path: string;
    totalEntries: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export async function readDirHeader(client: Client): Promise<DirHeader> {
    const [version] = await client.read(1);
    const dirPath = await client.readString();
    const rest = await client.read(7);
    return {
        version,
        path: dirPath,
        totalEntries: rest.readUInt16LE(0),
        page: rest.readUInt16LE(2),
        pageSize: rest[4],
        totalPages: rest.readUInt16LE(5),
    };
}

export async function getDir(client: Client, page?: number): Promise<{ header: DirHeader; entries: DirEntry[] }> {
    client.command(page === undefined ? 'DIR' : `DIR ${page}`);
    const header = await readDirHeader(client);
    const length = (await client.read(2)).readUInt16LE(0);
    const listing = await client.read(length);
    const [sum] = await client.read(1);
    if (sum !== checksum(listing)) {
        throw new Error('bad directory checksum');
    }
    const entries: DirEntry[] = [];
    let at = 0;
    while (at < listing.length) {
        const size = listing.readUInt32LE(at);
        const type = listing[at + 4];
        const end = listing.indexOf(0, at + 5);
        entries.push({ size, type, name: listing.subarray(at + 5, end).toString('latin1') });
        at = end + 1;
    }
    return { header, entries };
}

// The server logs every command with console.log
export function quiet(): void {
    mock.method(console, 'log', () => undefined);
}

export interface Setup {
    root: string;
    server: TestServer;
    client: Client;
}

// A public folder, a server on it and a connected client, all removed when
//    the test ends. `files` maps a path in the folder to its content; a path
//    that ends in "/" is a folder.
export async function setup(t: TestContext, files: Record<string, string | Uint8Array> = {}, options: ServerOptions = {}): Promise<Setup> {
    const root = makeRoot();
    for (const [name, content] of Object.entries(files)) {
        const target = path.join(root, name);
        if (name.endsWith('/')) {
            fs.mkdirSync(target, { recursive: true });
        } else {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, content);
        }
    }
    const server = await startTestServer(root, options);
    const client = await Client.connect(server.port);
    t.after(async () => {
        client.destroy();
        await server.close();
        removeRoot(root);
    });
    return { root, server, client };
}
