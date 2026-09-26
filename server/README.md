# Personal~~NBN~~Server

## Abstract
Personal~~NBN~~Server (hereafter referred to as PersonalServer) is a minimalist file-serving server for the NBN protocol.

It's been extracted from the CDN server to allow people to use NBN at home for file transfers. 

PersonalServer is designed to run be ONLY your own, secure, network -- therefore if it in someway can be compromised to expose files outside of the public folder there will be no danger.

If you choose to run this software you take all security responsibilities upon yourself.

**YOU HAVE BEEN WARNED**

## To Run
Requires Node.js 24.

Run `npm install` (which also builds), then `npm start`. It serves files from the public folder, or from the folder in `NBN_FILEPATH`.

Currently `config.json` support is missing, this is coming soon.

Server listens on all interfaces (`0.0.0.0`), port `48128`.

## Writing a server
A server is a subclass of `Server` (or of `PersonalServer`), started with `startServer(MyServer)`.

The session reads client input one line at a time and handles the lines in order. Each line gets exactly one answer. A line may be at most 256 bytes, and at most 16 lines may wait. A client that goes over either limit is disconnected with `BadCommand_ERROR`.

A handler returns `Promise<Answer>`:

```ts
export interface Answer {
  bytes: Uint8Array;   // written to the client
  close?: boolean;     // close the session after the bytes
}
```

To add a command, override `command()`, return your answer, and pass every other command to the base class:

```ts
import { closeWith, Server, type Answer } from "nbn-server";

export class MyServer extends Server {
    public override async command(cmd: string, params: readonly string[]): Promise<Answer> {
        switch (cmd) {
            case "HELLO":
                return { bytes: new TextEncoder().encode("HELLO\r\n") };
            case "BYE":
                return closeWith("OK");
            default:
                return super.command(cmd, params);
        }
    }
}
```

Rules:
- A handler never writes to the socket. The session writes the answer, and the next line waits until it is written.
- To end the session, return `closeWith(text)`. It sends the text and `\r\n`, then closes.
- An error that keeps the session open, such as `NoFile_ERROR`, is an ordinary answer.
- An error text starts with a letter. The client reads a first byte below 64, such as a digit, as a protocol version, and then does not show the error.
- `throw` is for unexpected errors only. The session logs the error and ends with `ServerException_ERROR`.
- Use asynchronous file calls (`fs.promises`). A synchronous call stops every session on the server.

## Contributors Note
This server is mostly the same as the server used to run the main NBN CDN, but missing a bunch of the additional service integration from the `/src/cdn` folder. PersonalServer **pull requests** will be entertained, but only if they don't conflict with the main NBNServer functions since running NextBestNetwork is our primary concern regarding this software. We trust you understand.

