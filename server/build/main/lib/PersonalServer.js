"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonalServer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const Logger_1 = require("./Logger");
const MAX_FILE_SIZE = 4294967295;
const DEFAULT_BLOCK_SIZE = 4096;
const DEFAULT_CHECKSUM = 256;
const DEFAULT_DIR_SIZE = 16;
const PROTOCOL_VERSION = 2;
const NBN_COMMAND_NEXT = "!".charCodeAt(0);
const NBN_COMMAND_BACK = "<".charCodeAt(0);
class PersonalServer {
    constructor(session) {
        this.session = session;
        this.state = "W"; // WAITING
        this.preferredBlockSize = DEFAULT_BLOCK_SIZE;
        this.preferredDirSize = DEFAULT_DIR_SIZE;
        this.checksumBase = DEFAULT_CHECKSUM;
        this.currentWorkingDirectory = '';
        Logger_1.log(`PersonalServer created for ${this.session.socket.remoteAddress}:${this.session.socket.remotePort}`);
    }
    command(cmd, params) {
        switch (cmd) {
            case "GET":
                this.sendFile(params.join(' '));
                break;
            case "LS":
            case "CAT":
            case "DIR":
                this.sendDir(parseInt(params[0]));
                break;
            case "QUIT":
                this.session.end("OK");
                break;
            default:
                this.session.end("BadCommand_ERROR");
        }
    }
    data(buffer) {
        switch (this.state) {
            case "S": // SERVING file to NBNClient
                if (buffer[0] === NBN_COMMAND_NEXT) {
                    this.block++;
                    this.retries = 0;
                    this.readFileBlock();
                }
                else if (buffer[0] === NBN_COMMAND_BACK) {
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
                if (buffer[0] === NBN_COMMAND_NEXT) {
                    this.session.state = 'W';
                }
                else if (buffer[0] === NBN_COMMAND_BACK) {
                    this.retries++;
                    this.sendBlock();
                }
                break;
            default:
                break;
        }
    }
    sendDir(dirPage = 1) {
        const absPath = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory);
        Logger_1.log(absPath, this.preferredDirSize);
        if (!fs.existsSync(absPath)) {
            this.session.end("BadFile_ERROR");
            return;
        }
        Logger_1.log(`LISTING "${absPath}", Page ${dirPage}`);
        fs.readdir(absPath, (err, files) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            }
            else {
                // First, what page did they ask for
                const firstFile = (dirPage - 1) * this.preferredDirSize;
                // this.blockData = new Uint8Array(this.blockSize);
                Logger_1.log(files, firstFile);
                //
                //             // Send the DIRHEADER
                //             this.session.socket.write(Uint8Array.from([
                //                 // Protocol Version    Uint8
                //                 PROTOCOL_VERSION,
                //                 // Total Dir Size                Uint16
                //                 (files.length >> 8), (files.length) & 255,
                //                 // Complete Blocks     Uint32
                //                 (this.totalBlocks >> 24), (this.totalBlocks >> 16) & 255, (this.totalBlocks >> 8) & 255, (this.totalBlocks) & 255,
                //                 // Bytes Remaining     Uint16
                //                 (this.remainder >> 8), this.remainder & 255,
                //             ]));
                //
                //             // Terminating NULL    0x00
                //             this.session.socket.write(Uint8Array.from([0]));
            }
        });
    }
    sendFile(file) {
        this.session.state = "S"; // Flag in session
        this.state = "S"; // Flag in handler
        this.block = 0;
        this.blockSize = this.preferredBlockSize; // Variable blocksize, we shorten the last to fit
        const absFile = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory + file);
        if (!absFile.startsWith(this.session.config.FILEPATH)) {
            this.session.end("BadPath_ERROR");
            return;
        }
        if (!fs.existsSync(absFile)) {
            this.session.end("BadFile_ERROR");
            return;
        }
        Logger_1.log(`STATING ${absFile}" `);
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
        this.totalBlocks = Math.floor(stats.size / this.preferredBlockSize);
        this.remainder = stats.size % this.preferredBlockSize;
        this.checksum = 0;
        Logger_1.log((stats.size) & 255, (stats.size >> 8) & 255, (stats.size >> 16) & 255, (stats.size >> 24));
        fs.open(absFile, 'r', (err, fd) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            }
            else {
                this.fileHandle = fd;
                // Send the FILEHEADER
                this.session.socket.write(Uint8Array.from([
                    // Protocol Version    Uint8
                    PROTOCOL_VERSION,
                    // Size                Uint32
                    (stats.size) & 255, (stats.size >> 8) & 255, (stats.size >> 16) & 255, (stats.size >> 24),
                    // Complete Blocks     Uint32
                    (this.totalBlocks) & 255, (this.totalBlocks >> 8) & 255, (this.totalBlocks >> 16) & 255, (this.totalBlocks >> 24),
                    // Bytes Remaining     Uint16
                    this.remainder & 255, (this.remainder >> 8),
                ]));
                // String <128char     UChar
                this.session.socket.write(filename);
                // Terminating NULL    0x00
                this.session.socket.write(Uint8Array.from([0]));
            }
        });
    }
    readFileBlock() {
        this.blockData = new Uint8Array(this.blockSize);
        this.checksum = 0;
        this.retries = 0;
        if (this.block > this.totalBlocks) {
            this.blockSize = this.remainder;
            this.state = "C"; // We've now COMPLETED reading all the blocks
        }
        fs.read(this.fileHandle, this.blockData, 0, this.blockSize, null, (err, bytesRead) => {
            if (bytesRead < this.blockSize) {
                this.session.end("ServerException_ERROR");
            }
            else if (err) {
                this.session.end("ServerException_ERROR");
            }
            else {
                for (let i = 0; i < this.blockSize; i++) {
                    this.checksum = this.checksum + this.blockData[i];
                }
                this.checksum = this.checksum % this.checksumBase;
                this.sendBlock();
            }
        });
    }
    sendBlock() {
        this.session.socket.write(this.blockData.slice(0, this.blockSize));
        this.session.socket.write(Uint8Array.from([this.checksum]));
    }
}
exports.PersonalServer = PersonalServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGVyc29uYWxTZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvbGliL1BlcnNvbmFsU2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLCtCQUFtQztBQUNuQyxxQ0FBK0I7QUFHL0IsTUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDO0FBQ2pDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDO0FBQ2hDLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxDQUFDO0FBQzdCLE1BQU0sZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO0FBQzVCLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0FBRTNCLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMzQyxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFFM0MsTUFBYSxjQUFjO0lBZ0J2QixZQUFZLE9BQWdCO1FBQ3hCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLENBQUMsVUFBVTtRQUM1QixJQUFJLENBQUMsa0JBQWtCLEdBQUcsa0JBQWtCLENBQUM7UUFDN0MsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDO1FBQ3pDLElBQUksQ0FBQyxZQUFZLEdBQUcsZ0JBQWdCLENBQUM7UUFDckMsSUFBSSxDQUFDLHVCQUF1QixHQUFHLEVBQUUsQ0FBQTtRQUVqQyxZQUFHLENBQUMsOEJBQThCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBRSxDQUFDO0lBQzlHLENBQUM7SUFFTSxPQUFPLENBQUMsR0FBVyxFQUFF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