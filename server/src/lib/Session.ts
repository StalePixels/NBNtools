import type * as net from 'node:net';
import { TextEncoder } from 'node:util';
import type { Config } from './Config.js';
import { log } from './Logger.js';
import type { Server } from './Server.js';

const MAX_LINE_LENGTH = 256;
const MAX_QUEUED_LINES = 16;

// Differnt classess mean content servers can add additional features (such as Authentication,
//    and gateways to custom/private services to the codebase, easily, without breaking
//    the licence on the open source portions of the software - or bloating the base protocol.
export type ServerClass = new (session: Session) => Server;

function concatTypedArrays(a: Uint8Array, b: ArrayLike<number>): Uint8Array { // a, b TypedArray of same type
  const c = new Uint8Array(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

export class Session {
  public readonly config: Config;
  public socket: net.Socket;
  public state: string;

  private server?: Server;
  private input: Buffer = Buffer.alloc(0);
  private lines: string[] = [];
  private busy = false;
  private held?: Promise<void>;

  constructor(socket: net.Socket, config: Config, ServerType: ServerClass) {
    this.config = config;
    this.socket = socket;

    this.server = new ServerType(this);
    this.state = "W";       // WAITING for command

    log(ServerType.name);

    // Set up socket listeners
    socket.on("data", (buffer) => {
      // retain the scope of this class, and then call the data (incoming) method
      this.data(buffer);
    });

    socket.on("error", (err) => {
      log(`Session error from ${socket.remoteAddress}:${socket.remotePort}: ${err.message}`);
      socket.destroy();
    });

    socket.on("close", () => {
      this.server?.closeFile();
    });
  }

  // A TCP read can hold several lines or part of one. nbnshell ends its
  //    commands LF then CR, so the CR arrives at the start of the next line.
  public data(buffer: Buffer): void {
    this.input = Buffer.concat([this.input, buffer]);

    let end = this.input.indexOf(10);
    while (end !== -1 && this.open()) {
      if (end > MAX_LINE_LENGTH) {
        this.end("BadCommand_ERROR");
        return;
      }
      const line = this.input.subarray(0, end).toString()
          .replace(/^[\r \t]+|[\r \t]+$/g, '');
      this.input = this.input.subarray(end + 1);
      if (line.length > 0) {
        if (this.lines.length >= MAX_QUEUED_LINES) {
          this.end("BadCommand_ERROR");
          return;
        }
        this.lines.push(line);
      }
      end = this.input.indexOf(10);
    }

    if (this.input.length > MAX_LINE_LENGTH && this.open()) {
      this.end("BadCommand_ERROR");
      return;
    }

    void this.drain();
  }

  // Lines are handled one at a time. A line whose work is asynchronous holds
  //    the next line until it calls release, so replies stay in order.
  public hold(): () => void {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.held = this.held ? Promise.all([this.held, held]).then(() => undefined) : held;
    return release;
  }

  private async drain(): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    while (this.lines.length > 0 && this.open()) {
      this.line(this.lines.shift()!);
      while (this.held) {
        const held = this.held;
        this.held = undefined;
        await held;
      }
    }
    this.busy = false;

    if (this.state==='Q') {
      delete this.server;
    }
  }

  private open(): boolean {
    return !this.socket.writableEnded && !this.socket.destroyed;
  }

  private line(line: string): void {
    switch(this.state) {
      case "W": {   // WAITING for command
        // Parse the commands
        const cmds = line.split(" ");                          // Break at space
        const cmd = cmds[0].toUpperCase();                      // Uppercase
        const params = cmds.slice(1,);                          // Leftovers after start of string
        log(`Dispatching COMMAND: "${cmd}" PARAMS: `, params, " to NBNServer");

        this.server?.command(cmd, params);

        break;
      }
      case "S":     // data currently being SENT by (NBN)Server
          this.server?.data(line);
        break;
      default:
        break;
    }
  }

  public end(message: string): void {
    log(`Session disconnected from ${this.socket.remoteAddress}:${this.socket.remotePort} for ${message}` );
    this.server?.closeFile();

    const error = new TextEncoder().encode(message);
    this.socket.write(concatTypedArrays(error, [13,10]));

    this.socket.end();
  }

}
