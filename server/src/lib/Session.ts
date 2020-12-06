import * as net from 'net'
import { TextEncoder } from "util";
import {log} from './Logger';
// import { NBNServer } from './NBNServer/NBNServer';
import { PersonalServer } from './PersonalServer';

function concatTypedArrays(a: any, b: any): any { // a, b TypedArray of same type
  const c = new (a.constructor)(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

export class Session {
  public readonly config: any;
  public socket: net.Socket;
  public state: string;

  private server: PersonalServer;

  constructor(socket: net.Socket, config: any) {
    this.config = config;
    this.socket = socket;

    /*
     *
     * Establish our file-server, this handles all the protocol management and is a reduced version of
     *   NBNServer with less features and commands.
     *
     *   This replaces any references you may see to NBNServer Class through-out the source code.
     *
     *   NBNServer is the CLOSED SOURCE module that has houses our special network source (catalogs, service
     *   gateways, and other planned features)
     */
    this.server = new PersonalServer(this);
    this.state = "W";       // WAITING for command

    // Set up socket listeners
    socket.on("data", (buffer) => {
      // retain the scope of this class, and then call the data (incoming) method
      this.data(buffer);
    });
  }

  public data(buffer: Buffer): void {
    switch(this.state) {
      case "W":     // WAITING for command
        // Parse the commands
        const cmds = buffer.toString()                          // As string
            .replace(/^\s+|\s+$/g, '')  // Remove CR if any
            .split(" ");                              // Break at space
        const cmd = cmds[0].toUpperCase();                      // Uppercase
        const params = cmds.slice(1,);                          // Leftovers after start of string
        log(`Dispatching COMMAND: "${cmd}" PARAMS: `, params, " to NBNServer");

        this.server.command(cmd, params);

        break;
      case "S":     // data currently being SENT by (NBN)Server
          this.server.data(buffer);
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

    const error = new TextEncoder().encode(message);
    this.socket.write(concatTypedArrays(error, Uint8Array.from([13,10])));

    this.socket.end();
    delete this.socket;
  }

}
