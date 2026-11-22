# Personal~~NBN~~Server

## Abstract
Personal~~NBN~~Server (hereafter referred to as PersonalServer) is a minimalist file-serving server for the NBN protocol.

It's been extracted from the CDN server to allow people to use NBN at home for file transfers. 

PersonalServer is designed to run be ONLY your own, secure, network -- therefore if it in someway can be compromised to expose files outside of the public folder there will be no danger.

If you choose to run this software you take all security responsibilities upon yourself.

**YOU HAVE BEEN WARNED**

## To Run
Requires Node.js 24.

Run `npm install` (which also builds), then `npm start`.

## Settings
Settings come from environment variables, or from a `.env` file in the folder you start the server from. An environment variable that is set wins over the same name in `.env`.

```sh
# .env
NBN_FILEPATH=/Volumes/Stuff/Next
NBN_PORT=48128
```

| Name | Default | What it does |
| --- | --- | --- |
| `NBN_FILEPATH` | `public` | The folder to share. A full path, or a path from the current folder. The server stops when the folder does not exist. |
| `NBN_IP` | `0.0.0.0` | The address to listen on. `0.0.0.0` is every network interface. |
| `NBN_PORT` | `48128` | The TCP port to listen on. |
| `NBN_SHOWDOTS` | `false` | `true` shows names that start with `.` in `DIR`. |
| `NBN_BACKLOG` | `128` | How many new connections can wait while the server is busy. |
| `NBN_RETRY` | `1000` | When the port is in use, the time in milliseconds before the server tries again. |
| `NBN_IDLE` | `600000` | The time in milliseconds a connection can stay silent before the server closes it. |
| `NBN_MAXCONNS` | `512` | The most connections open at once. The server closes new connections over this limit. |
| `NBN_MAXPERIP` | `16` | The most connections open at once from one address. |

A program that uses the library can give `startServer()` a `Config` of its own. With no `Config`, `startServer()` reads the environment variables.

## Tests
`npm test` builds the server and runs the tests in `test/`. Each test starts its own server on a free port of `127.0.0.1`, with a new public folder in the system temp folder.

`test/nbnget.test.ts` builds the POSIX `nbnget` with `make posix` in `clients/nbnget`, and fetches files with it. When that build fails, the `nbnget` tests skip.

## Writing files
PersonalServer lets clients write into the public folder, as well as read from it. Anyone who can reach the port can write.

Names that start with `/` count from the top of the public folder, as with `CD`. Other names count from the current folder. The server refuses names that lead outside the public folder.

Each answer is `!\r\n` or `<\r\n`, so a client can read it with `NBN_GetStatus()`. A line without its name or size gets `BadCommand_ERROR\r\n` instead, as an unknown command does.

`MKDIR <name>` makes a folder, and any missing folders above it. The answer is `!` when the folder exists afterwards, so a folder that was already there also gets `!`. The answer is `<` when the server cannot make the folder, such as when a file has that name.

`PUT <size> <name>` sends a file. `<size>` is in bytes. `PUT` overwrites existing files. The server answers `!` when it is ready for the data. It answers `<` when the folder does not exist, when the name is a folder, or when the name leads outside the public folder.

- End the `PUT` line with LF or CR LF, never LF CR. Every byte after the LF is file data, so a CR after it becomes the first byte of the file.
- After the `!`, send the file in the same blocks as `GET`: full blocks of 4096 bytes, then one last block with the rest, which can be empty. Follow each block with its checksum, the sum of its bytes modulo 256.
- The server answers each block with `!`, or with `<` when the checksum is wrong. After `<`, send the block again. When one block fails its checksum a fourth time, the server ends the session with `ExcessRetries_ERROR`.
- The server closes the file before it sends the `!` for the last block.

Sessions that end during a `PUT` leave a partial file. When the `PUT` was an overwrite, the old file is already gone.

## Writing a server
A server is a subclass of `Server`, started with `startServer(MyServer)`. `Server` is read-only. A subclass of `PersonalServer` gets `PUT` and `MKDIR`, so any client that can reach it can write. A server on the internet, such as the CDN, must extend `Server`.

The session reads client input one line at a time and handles the lines in order. Each line gets exactly one answer. A line may be at most 256 bytes, and at most 16 lines may wait. A client that goes over either limit is disconnected with `BadCommand_ERROR`. So is a command line with a control character other than TAB, because that is binary data, such as a TLS handshake.

An unknown command gets `BadCommand_ERROR\r\n`, and the session stays open, so a person can fix a typo. The third unknown command in one session ends it, because bots send many. To count a malformed command of your own the same way, return `this.badCommand()`.

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

To read bytes that are not a line, such as file data, call `session.receive(count, handler)` from a handler. The session writes that handler's answer, then passes the next `count` bytes to `handler` and writes the answer it returns. After that, the session reads lines again. `PersonalServer` uses it for `PUT`.

## Contributors Note
This server is mostly the same as the server used to run the main NBN CDN, but missing a bunch of the additional service integration from the `/src/cdn` folder. PersonalServer **pull requests** will be entertained, but only if they don't conflict with the main NBNServer functions since running NextBestNetwork is our primary concern regarding this software. We trust you understand.

