import fs from "fs";
import path from "path";
import { log } from "../Logger";
import { Server } from '../Server';
import { Session } from "../Session";

const MAX_MOTD_SIZE = 4096;

export class PersonalServer extends Server {
    constructor(session: Session){
        super(session);
    }

    public command(cmd: string, params: readonly string[]): void {
        log("PersonalServer COMMAND "+cmd+" WITH "+params);
        switch (cmd) {
            case "MOTD":
                this.motd();
                break;
            default:
                super.command(cmd, params);
        }
    }

    protected motd(): void {
        this.block = 0;
        this.blockSize = this.preferredBlockSize;               // Variable blocksize, we shorten the last to fit

        const absFile = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory + ".motd");

        if (!fs.existsSync(absFile)) {
            this.session.socket.write("NoMOTD_ERROR");
            this.session.socket.write(Uint8Array.from([13, 10]));
            return;
        }

        log(`MOTD serving ${absFile}" `);

        const stats = fs.statSync(absFile);

        if (stats.size > MAX_MOTD_SIZE) {
            this.session.socket.write("NoMOTD_ERROR");
            this.session.socket.write(Uint8Array.from([13, 10]));
            return;
        }

        const filename = path.basename(absFile);

        this.session.state = "S";                               // Flag in session
        this.state = "S";                                       // Flag in handler
        this.sendFileDangerous(filename, absFile, stats);
    }

}