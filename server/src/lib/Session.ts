import type * as net from 'node:net';
import { TextDecoder, TextEncoder } from 'node:util';
import type { Config } from './Config.js';
import { log } from './Logger.js';
import type { Server } from './Server.js';

const MAX_LINE_LENGTH = 256;
const MAX_QUEUED_LINES = 16;

// Differnt classess mean content servers can add additional features (such as Authentication,
//    and gateways to custom/private services to the codebase, easily, without breaking
//    the licence on the open source portions of the software - or bloating the base protocol.
export type ServerClass = new (session: Session) => Server;

export interface Answer {
  bytes: Uint8Array;
  close?: boolean;
}

function concatTypedArrays(a: Uint8Array, b: ArrayLike<number>): Uint8Array { // a, b TypedArray of same type
  const c = new Uint8Array(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

export function closeWith(message: string): Answer {
  return { bytes: concatTypedArrays(new TextEncoder().encode(message), [13, 10]), close: true };
}

export class Session {
  public readonly config: Config;
  public socket: net.Socket;
  public state: string;

  private server?: Server;
  private input: Buffer = Buffer.alloc(0);
  private lines: string[] = [];
  private busy = false;

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
        this.end(closeWith("BadCommand_ERROR"));
        return;
      }
      const line = this.input.subarray(0, end).toString()
          .replace(/^[\r \t]+|[\r \t]+$/g, '');
      this.input = this.input.subarray(end + 1);
      if (line.length > 0) {
        if (this.lines.length >= MAX_QUEUED_LINES) {
          this.end(closeWith("BadCommand_ERROR"));
          return;
        }
        this.lines.push(line);
      }
      end = this.input.indexOf(10);
    }

    if (this.input.length > MAX_LINE_LENGTH && this.open()) {
      this.end(closeWith("BadCommand_ERROR"));
      return;
    }

    void this.drain();
  }

  // Lines are handled one at a time, and each answer is written before the
  //    next line starts, so answers stay in order.
  private async drain(): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    while (this.lines.length > 0 && this.open()) {
      let answer: Answer;
      try {
        answer = await this.line(this.lines.shift()!);
      } catch (err) {
        log(err);
        answer = closeWith("ServerException_ERROR");
      }
      if (!this.open()) {
        break;
      }
      if (answer.close) {
        this.end(answer);
      } else {
        this.socket.write(answer.bytes);
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

  private async line(line: string): Promise<Answer> {
    switch(this.state) {
      case "W": {   // WAITING for command
        // Parse the commands
        const cmds = line.split(" ");                          // Break at space
        const cmd = cmds[0].toUpperCase();                      // Uppercase
        const params = cmds.slice(1,);                          // Leftovers after start of string
        log(`Dispatching COMMAND: "${cmd}" PARAMS: `, params, " to NBNServer");

        return await this.server?.command(cmd, params) ?? { bytes: new Uint8Array() };
      }
      case "S":     // data currently being SENT by (NBN)Server
        return await this.server?.data(line) ?? { bytes: new Uint8Array() };
      default:
        return { bytes: new Uint8Array() };
    }
  }

  private end(answer: Answer): void {
    log(`Session disconnected from ${this.socket.remoteAddress}:${this.socket.remotePort} for ${new TextDecoder().decode(answer.bytes).trim()}` );
    this.server?.closeFile();

    this.socket.write(answer.bytes);

    this.socket.end();
  }

}
