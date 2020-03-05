"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Logger_1 = require("./Logger");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const MAX_FILE_SIZE = 4294967295;
class PersonalServer {
    constructor(session) {
        this.session = session;
        this.state = "W"; // WAITING
        Logger_1.log(`PersonalServer created for ${this.session.socket.remoteAddress}:${this.session.socket.remotePort}`);
    }
    command(cmd, params) {
        switch (cmd) {
            case "GET":
                this.send(params.join(' '));
                break;
            case "QUIT":
                this.session.end("OK");
                break;
            default:
                this.session.end("BadCommand_ERROR");
        }
    }
    send(file) {
        this.session.state = "S"; // SENDING file
        this.state = "S"; // SENDING file
        this.block = 0;
        const absFile = path.resolve(this.session.config.FILEPATH + file);
        if (!absFile.startsWith(this.session.config.FILEPATH)) {
            this.session.end("BadPath_ERROR");
            return;
        }
        if (!fs.existsSync(absFile)) {
            this.session.end("BadFile_ERROR");
            return;
        }
        Logger_1.log(`STATING ${file} from "${this.session.config.FILEPATH}" `);
        const stats = fs.statSync(absFile);
        if (stats.size > MAX_FILE_SIZE) {
            this.session.end("FileTooBig_ERROR");
            return;
        }
        const filename = path.basename(absFile);
        if (filename.length > 127) {
            const error = new util_1.TextEncoder().encode("FilenameTooLong_ERROR").toString();
            this.session.end(error);
            this.state = "Q"; // QUIT
            return;
        }
        this.totalBlocks = Math.floor(stats.size / 240);
        this.remainder = stats.size % 240;
        Logger_1.log(` Size:\t${stats.size >> 24}|${(stats.size >> 16) & 255}|${(stats.size >> 8) & 255}|${stats.size & 255}\n` +
            ` Blocks:\t${this.totalBlocks >> 24}|${(this.totalBlocks >> 16) & 255}|${(this.totalBlocks >> 8) & 255}|${this.totalBlocks & 255}\n` +
            ` Remainder:\t${this.remainder}\n` +
            ` Filename:\t${filename}`);
        this.checksum = 0;
        fs.open(absFile, 'r', (err, fd) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            }
            else {
                this.fileHandle = fd;
                // Send the HEADER
                this.session.socket.write(Uint8Array.from([
                    // Protocol Version    Uint8
                    1,
                    // Size                Uint32
                    (stats.size >> 24), (stats.size >> 16) & 255, (stats.size >> 8) & 255, (stats.size) & 255,
                    // Complete Blocks     Uint32
                    (this.totalBlocks >> 24), (this.totalBlocks >> 16) & 255, (this.totalBlocks >> 8) & 255, (this.totalBlocks) & 255,
                    // Bytes Remaining     Uint8
                    this.remainder
                ]));
                // String <128char     UChar
                this.session.socket.write(filename);
                // Terminating NULL    0x00
                this.session.socket.write(Uint8Array.from([0]));
            }
        });
    }
    data(buffer) {
        switch (this.state) {
            case "S": // STREAM data to NBNServer
                if (buffer[0] === 33) {
                    this.block++;
                    this.retries = 0;
                    this.readBlock();
                }
                else if (buffer[0] === 63) {
                    if (this.retries < 3) {
                        this.retries++;
                        this.sendBlock();
                    }
                    else {
                        this.session.end("ExcessRetries_ERROR");
                    }
                }
                break;
            case "C": // FILE COMPLETE
                if (buffer[0] === 33) {
                    this.state = 'W';
                }
                else if (buffer[0] === 63) {
                    this.retries++;
                    this.sendBlock();
                }
                break;
            default:
                break;
        }
    }
    readBlock() {
        this.blockData = new Uint8Array(240);
        this.checksum = 0;
        this.retries = 0;
        let size = 240;
        if (this.block > this.totalBlocks) {
            size = this.remainder;
            this.state = "C"; // We've now COMPLETED reading all the blocks
        }
        // const size = (this.block>this.totalBlocks) ? this.remainder : 240;
        // @ts-ignore
        fs.read(this.fileHandle, this.blockData, 0, size, null, (err, bytesRead, buffer) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            }
            else {
                for (let i = 0; i < size; i++) {
                    this.checksum = this.checksum + this.blockData[i];
                }
                this.checksum = this.checksum % 65535;
                this.sendBlock();
            }
        });
    }
    sendBlock() {
        this.session.socket.write(this.blockData.slice(0, (this.block > this.totalBlocks) ? this.remainder : 240));
        this.session.socket.write(Uint8Array.from([this.checksum >> 8, this.checksum & 255]));
    }
}
exports.PersonalServer = PersonalServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGVyc29uYWxTZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvbGliL1BlcnNvbmFsU2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLHFDQUErQjtBQUUvQiwyQ0FBNkI7QUFDN0IsdUNBQXlCO0FBQ3pCLCtCQUFtQztBQUVuQyxNQUFNLGFBQWEsR0FBRyxVQUFVLENBQUM7QUFFakMsTUFBYSxjQUFjO0lBV3ZCLFlBQVksT0FBZ0I7UUFDeEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBQyxVQUFVO1FBRTVCLFlBQUcsQ0FBQyw4QkFBOEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFFLENBQUM7SUFDOUcsQ0FBQztJQUVNLE9BQU8sQ0FBQyxHQUFXLEVBQUUsTUFBeUI7UUFDakQsUUFBUSxHQUFHLEVBQUU7WUFDVCxLQUFLLEtBQUs7Z0JBQ04sSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQzVCLE1BQU07WUFDVixLQUFLLE1BQU07Z0JBQ1AsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3ZCLE1BQU07WUFDVjtnQkFDSSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1NBQzVDO0lBQ0wsQ0FBQztJQUdPLElBQUksQ0FBQyxJQUFZO1FBQ3JCLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFPLGVBQWU7UUFDL0MsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBTyxlQUFlO1FBQ3ZDLElBQUksQ0FBQyxLQUFLLEdB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