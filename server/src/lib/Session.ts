import type * as net from 'node:net';
import { TextEncoder } from 'node:util';
import type { Config } from './Config.js';
import { log } from './Logger.js';
import type { Server } from './Server.js';

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

  public data(buffer: Buffer): void {
    switch(this.state) {
      case "W": {   // WAITING for command
        // Parse the commands
        const cmds = buffer.toString()                          // As string
            .replace(/^\s+|\s+$/g, '')  // Remove CR if any
            .split(" ");                              // Break at space
        const cmd = cmds[0].toUpperCase();                      // Uppercase
        const params = cmds.slice(1,);                          // Leftovers after start of string
        log(`Dispatching COMMAND: "${cmd}" PARAMS: `, params, " to NBNServer");

        this.server?.command(cmd, params);

        break;
      }
      case "S":     // data currently being SENT by (NBN)Server
          this.server?.data(buffer);
        break;
      default:
        break;
    }

    if (this.state==='Q') {
      delete this.server;
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
