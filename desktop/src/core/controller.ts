import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { PersonalServer, startServer, type Config } from 'nbn-server';
import { isValidPort } from './settings.ts';

export interface ServerOptions {
    folder: string;
    port: number;
    showDots: boolean;
    ip?: string;
}

export interface ServerStatus {
    running: boolean;
    port?: number;
    error?: string;
}

// The server library's defaults for the settings the app does not show.
const LIBRARY_DEFAULTS = {
    BACKLOG: 128,
    IDLE: 600000,
    MAXCONNS: 512,
    MAXPERIP: 16,
};

// The error text for a folder that cannot be shared, or undefined when it can.
export function checkFolder(folder: string): string | undefined {
    if (folder === '') {
        return 'Choose a folder to share.';
    }
    try {
        if (fs.statSync(folder).isDirectory()) {
            return undefined;
        }
        return `${folder} is not a folder. Choose a folder to share.`;
    } catch {
        return `The folder ${folder} no longer exists. Choose a folder to share.`;
    }
}

function portError(err: NodeJS.ErrnoException, port: number): string {
    if (err.code === 'EADDRINUSE') {
        return `Port ${port} is in use by another program. Close that program, or choose another port.`;
    }
    if (err.code === 'EACCES') {
        return `This computer does not let the app use port ${port}. Choose another port.`;
    }
    return `The server cannot use port ${port}: ${err.message}`;
}

// Starts and stops one PersonalServer. Emits 'status' with a ServerStatus
//    each time the status changes.
export class ServerController extends EventEmitter {
    private server?: net.Server;
    private sockets = new Set<net.Socket>();
    private current: ServerStatus = { running: false };

    public get status(): ServerStatus {
        return this.current;
    }

    private setStatus(status: ServerStatus): void {
        this.current = status;
        this.emit('status', status);
    }

    public async start(options: ServerOptions): Promise<ServerStatus> {
        if (this.server !== undefined) {
            return this.current;
        }
        const folderError = checkFolder(options.folder);
        if (folderError !== undefined) {
            this.setStatus({ running: false, error: folderError });
            return this.current;
        }
        if (!isValidPort(options.port)) {
            this.setStatus({ running: false, error: 'The port must be a number from 1 to 65535.' });
            return this.current;
        }
        // RETRY 0: when the port is in use, the server emits 'error' and
        //    does not try again.
        const config: Config = {
            ...LIBRARY_DEFAULTS,
            FILEPATH: path.resolve(options.folder),
            IP: options.ip ?? '0.0.0.0',
            RETRY: 0,
            PORT: options.port,
            SHOWDOTS: options.showDots,
        };
        const server = startServer(PersonalServer, config);
        this.server = server;
        server.on('connection', (socket: net.Socket) => {
            this.sockets.add(socket);
            socket.on('close', () => this.sockets.delete(socket));
        });

        return new Promise((resolve) => {
            server.on('listening', () => {
                if (this.server !== server) {
                    // Stopped before the port opened.
                    server.close();
                    return;
                }
                this.setStatus({ running: true, port: options.port });
                resolve(this.current);
            });
            server.on('error', (err: NodeJS.ErrnoException) => {
                if (this.server !== server) {
                    return;
                }
                this.server = undefined;
                server.close();
                this.setStatus({ running: false, error: portError(err, options.port) });
                resolve(this.current);
            });
        });
    }

    // Closes the server and every open connection.
    public async stop(): Promise<void> {
        const server = this.server;
        if (server === undefined) {
            return;
        }
        this.server = undefined;
        for (const socket of this.sockets) {
            socket.destroy();
        }
        this.sockets.clear();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        this.setStatus({ running: false });
    }
}
