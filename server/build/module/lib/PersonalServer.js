import * as fs from "fs";
import * as path from "path";
import { TextEncoder } from "util";
import { log } from "./Logger";
const MAX_FILE_SIZE = 4294967295;
const DEFAULT_BLOCK_SIZE = 4096;
const DEFAULT_CHECKSUM = 256;
const DEFAULT_DIR_SIZE = 16;
const PROTOCOL_VERSION = 2;
const NBN_COMMAND_NEXT = "!".charCodeAt(0);
const NBN_COMMAND_BACK = "<".charCodeAt(0);
// tslint:disable-next-line:typedef
function concatTypedArrays(a, b) {
    const c = new (a.constructor)(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
}
export class PersonalServer {
    constructor(session) {
        this.session = session;
        this.state = "W"; // WAITING
        this.preferredBlockSize = DEFAULT_BLOCK_SIZE;
        this.preferredDirSize = DEFAULT_DIR_SIZE;
        this.checksumBase = DEFAULT_CHECKSUM;
        this.currentWorkingDirectory = '/';
        log(`PersonalServer created for ${this.session.socket.remoteAddress}:${this.session.socket.remotePort}`);
    }
    command(cmd, params) {
        log("COMMAND " + cmd + " WITH " + params);
        switch (cmd) {
            case "GET":
                this.sendFile(params.join(' '));
                break;
            case "DIR":
                this.sendDir(params);
                break;
            case "CD":
                this.changeDir(params.join(' '));
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
    sendDir(params = []) {
        const absPath = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory) + path.sep;
        if (!fs.existsSync(absPath)) {
            this.session.end("BadFile_ERROR");
            return;
        }
        if (!absPath.startsWith(this.session.config.FILEPATH)) {
            this.session.end("BadFile_ERROR");
            return;
        }
        const relPath = absPath.replace(this.session.config.FILEPATH, '');
        log(this.session.config.FILEPATH.length, this.session.config.FILEPATH, absPath.length, absPath);
        fs.readdir(absPath, (err, files) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            }
            else {
                // Part Zero, check the config, and see if we show hidden folders or not..
                // @ts-ignore: readonly-array
                let dirList = [];
                if (absPath.length - this.session.config.FILEPATH.length > 1) {
                    // cheap and cheerful subdir checking
                    dirList[0] = "..";
                }
                if (this.session.config.SHOWDOTS === false) {
                    files.forEach((file) => {
                        if (!file.startsWith(".")) {
                            dirList.push(file);
                        }
                    });
                }
                else {
                    dirList = dirList.concat(files);
                }
                // First, what page did they ask for
                let dirPage = parseInt(params[0], 10);
                if (!dirPage) {
                    dirPage = 1;
                }
                const directoryOffset = (dirPage - 1) * this.preferredDirSize;
                const totalPages = Math.ceil(dirList.length / this.preferredDirSize);
                const page = dirList.slice(directoryOffset, directoryOffset + this.preferredDirSize);
                let listing = new Uint8Array();
                page.forEach((entry) => {
                    const fileStat = fs.statSync(absPath + entry);
                    const filesize = fileStat.size;
                    const filetype = fileStat.isDirectory() ? 0 : 1;
                    // Current File Size                Uint32
                    listing = concatTypedArrays(listing, [(filesize) & 255,
                        (filesize >> 8) & 255, (filesize >> 16) & 255, (filesize >> 24) & 255]);
                    // Current File Type                Uint8
                    listing = concatTypedArrays(listing, [filetype]);
                    const entryArray = new TextEncoder().encode(entry);
                    listing = concatTypedArrays(listing, entryArray);
                    listing = concatTypedArrays(listing, [0]);
                });
                let header = new Uint8Array();
                // VER                                  Uint8 (<=63)
                header = concatTypedArrays(header, [PROTOCOL_VERSION]);
                // Path                                 NULL terminated string
                header = concatTypedArrays(header, new TextEncoder().encode(relPath));
                header = concatTypedArrays(header, [0]);
                // Total Entries in this dir            Uint16
                header = concatTypedArrays(header, [(dirList.length) & 255, (dirList.length >> 8)]);
                // Current Page Number                  Uint16
                header = concatTypedArrays(header, [(dirPage) & 255, (dirPage >> 8) & 255]);
                // Current Page Size                    Uint8
                header = concatTypedArrays(header, [page.length]);
                // Total Pages in the dir               Uint16
                header = concatTypedArrays(header, [(totalPages) & 255, (totalPages >> 8)]);
                // Size of NBNBlock                     Uint16
                header = concatTypedArrays(header, [(listing.length) & 255, (listing.length >> 8)]);
                // Send the DIRHEADER
                this.session.socket.write(header);
                // Send the filenames
                this.session.socket.write(listing);
                this.checksum = 0;
                for (const letter of listing) {
                    this.checksum = this.checksum + letter;
                }
                this.checksum = this.checksum % this.checksumBase;
                this.session.socket.write(Uint8Array.from([this.checksum]));
            }
        });
    }
    changeDir(dir) {
        const absPath = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory + path.sep + dir) + path.sep;
        if (!fs.existsSync(absPath)) {
            this.session.socket.write(Uint8Array.from([60, 13, 10]));
            return;
        }
        if (!fs.statSync(absPath).isDirectory()) {
            this.session.socket.write(Uint8Array.from([60, 13, 10]));
            return;
        }
        if (!absPath.startsWith(this.session.config.FILEPATH)) {
            this.session.socket.write(Uint8Array.from([60, 13, 10]));
            return;
        }
        this.session.socket.write(Uint8Array.from([33, 13, 10]));
        const relPath = absPath.replace(this.session.config.FILEPATH, '');
        this.currentWorkingDirectory = relPath;
        log(absPath, this.currentWorkingDirectory);
        fs.readdir(absPath, (err, files) => {
            if (err) {
                this.session.end("ServerException_ERROR");
            }
            else {
                // Part Zero, check the config, and see if we show hidden folders or not..
                // @ts-ignore: readonly-array
                let dirList = [];
                if (absPath.length - this.session.config.FILEPATH.length > 1) {
                    // cheap and cheerful subdir checking
                    dirList[0] = "..";
                }
                if (this.session.config.SHOWDOTS === false) {
                    files.forEach((file) => {
                        if (!file.startsWith(".")) {
                            dirList.push(file);
                        }
                    });
                }
                else {
                    dirList = dirList.concat(files);
                }
                // First, what page did they ask for
                const dirPage = 1;
                const directoryOffset = (dirPage - 1) * this.preferredDirSize;
                const totalPages = Math.ceil(files.length / this.preferredDirSize);
                const page = files.slice(directoryOffset, directoryOffset + this.preferredDirSize);
                let header = new Uint8Array();
                // VER                                  Uint8 (<=63)
                header = concatTypedArrays(header, [PROTOCOL_VERSION]);
                // Path                                 NULL terminated string
                header = concatTypedArrays(header, new TextEncoder().encode(this.currentWorkingDirectory));
                header = concatTypedArrays(header, [0]);
                // Total Entries in this dir            Uint16
                header = concatTypedArrays(header, [(files.length) & 255, (files.length >> 8)]);
                // Current Page Number                  Uint16
                header = concatTypedArrays(header, [(dirPage) & 255, (dirPage >> 8) & 255]);
                // Current Page Size                    Uint8
                header = concatTypedArrays(header, [page.length]);
                // Total Pages in the dir               Uint16
                header = concatTypedArrays(header, [(totalPages) & 255, (totalPages >> 8)]);
                // Send the DIRHEADER
                this.session.socket.write(header);
            }
        });
    }
    sendFile(file) {
        this.block = 0;
        this.blockSize = this.preferredBlockSize; // Variable blocksize, we shorten the last to fit
        const absFile = path.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory + file);
        log(absFile);
        if (!absFile.startsWith(this.session.config.FILEPATH)) {
            this.session.socket.write("BadPath_ERROR");
            this.session.socket.write(Uint8Array.from([13, 10]));
            return;
        }
        if (!fs.existsSync(absFile) || fs.statSync(absFile).isDirectory()) {
            this.session.socket.write("NoFile_ERROR");
            this.session.socket.write(Uint8Array.from([13, 10]));
            return;
        }
        log(`STATING ${absFile}" `);
        const stats = fs.statSync(absFile);
        if (stats.size > MAX_FILE_SIZE) {
            this.session.socket.write("FileTooBig_ERROR");
            this.session.socket.write(Uint8Array.from([13, 10]));
            return;
        }
        const filename = path.basename(absFile);
        if (filename.length > 127) {
            this.session.end("FilenameTooLong_ERROR");
            this.state = "Q"; // QUIT
            return;
        }
        this.session.state = "S"; // Flag in session
        this.state = "S"; // Flag in handler
        this.sendFileDangerous(filename, absFile, stats);
    }
    sendFileDangerous(filename, absFile, stats) {
        this.totalBlocks = Math.floor(stats.size / this.preferredBlockSize);
        this.remainder = stats.size % this.preferredBlockSize;
        this.checksum = 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGVyc29uYWxTZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvbGliL1BlcnNvbmFsU2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQzdCLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDbkMsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUcvQixNQUFNLGFBQWEsR0FBRyxVQUFVLENBQUM7QUFDakMsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUM7QUFDaEMsTUFBTSxnQkFBZ0IsR0FBRyxHQUFHLENBQUM7QUFDN0IsTUFBTSxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7QUFDNUIsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7QUFFM0IsTUFBTSxnQkFBZ0IsR0FBRyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzNDLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUUzQyxtQ0FBbUM7QUFDbkMsU0FBUyxpQkFBaUIsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUMzQixNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ25ELENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ1osQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ25CLE9BQU8sQ0FBQyxDQUFDO0FBQ2IsQ0FBQztBQUVELE1BQU0sT0FBTyxjQUFjO0lBZ0J2QixZQUFZLE9BQWdCO1FBQ3hCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLENBQUMsVUFBVTtRQUM1QixJQUFJLENBQUMsa0JBQWtCLEdBQUcsa0JBQWtCLENBQUM7UUFDN0MsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDO1FBQ3pDLElBQUksQ0FBQyxZQUFZLEdBQUcsZ0JBQWdCLENBQUM7UUFDckMsSUFBSSxDQUFDLHVCQUF1QixHQUFHLEdBQUcsQ0FBQTtRQUVsQyxHQUFHLENBQUMsOEJBQThCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBRSxDQUFDO0lBQzlHLENBQUM7SUFFTSxPQUFPLENBQUMsR0FBVyxFQUFFLE1BQXlCO1FBQ2pELEdBQUcsQ0FBQyxVQUFVLEdBQUMsR0FBRyxHQUFDLFFBQVEsR0FBQyxNQUFNLENBQUMsQ0FBQztRQUNwQyxRQUFRLEdBQUcsRUFBRTtZQUNULEtBQUssS0FBSztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDaEMsTUFBTTtZQUNWLEtBQUssS0FBSztnQkFDTixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNyQixNQUFNO1lBQ1YsS0FBSyxJQUFJO2dCQUNMLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNqQyxNQUFNO1lBQ1YsS0FBSyxNQUFNO2dCQUNQLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN2QixNQUFNO1lBQ1Y7Z0JBQ0ksSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztTQUM1QztJQUNMLENBQUM7SUFFTSxJQUFJLENBQUMsTUFBYztRQUN0QixRQUFPLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDZixLQUFLLEdBQUcsRUFBTSw0QkFBNEI7Z0JBQ3RDLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFNLGdCQUFnQixFQUFFO29CQUNqQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQ2IsSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7b0JBQ2pCLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztpQkFDeEI7cUJBQU0sSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQU0sZ0JBQWdCLEVBQUU7b0JBQ3hDLElBQUcsSUFBSSxDQUFDLE9BQU8sR0FBQyxDQUFDLEVBQUU7d0JBQ2YsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUNmLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztxQkFDcEI7eUJBQU07d0JBQ0gsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQztxQkFDM0M7aUJBQ0o7Z0JBQ0QsTUFBTTtZQUNWLEtBQUssR0FBRyxFQUFLLGdCQUFnQjtnQkFDekIsSUFBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssZ0JBQWdCLEVBQUU7b0JBQy9CLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQztpQkFDNUI7cUJBQU0sSUFBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssZ0JBQWdCLEVBQUU7b0JBQ3RDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDZixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7aUJBQ3BCO2dCQUNELE1BQU07WUFDVjtnQkFDSSxNQUFNO1NBQ2I7SUFDTCxDQUFDO0lBRVMsT0FBTyxDQUFDLFNBQTRCLEVBQUU7UUFDNUMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEdBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUVuRyxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUN6QixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUNsQyxPQUFPO1NBQ1Y7UUFFRCxJQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUNsRCxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUNsQyxPQUFPO1NBQ1Y7UUFFRCxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVsRSxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNoRyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUNoQyxJQUFJLEdBQUcsRUFBRTtnQkFDTCxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO2FBQzdDO2lCQUFNO2dCQUNILDBFQUEwRTtnQkFDMUUsNkJBQTZCO2dCQUM3QixJQUFJLE9BQU8sR0FBYyxFQUFFLENBQUM7Z0JBQzVCLElBQUcsT0FBTyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtvQkFDekQscUNBQXFDO29CQUNyQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO2lCQUNyQjtnQkFDRCxJQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsS0FBSyxLQUFLLEVBQUU7b0JBQ3ZDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTt3QkFDbkIsSUFBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUU7NEJBQ3RCLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7eUJBQ3RCO29CQUNMLENBQUMsQ0FBQyxDQUFDO2lCQUNOO3FCQUFNO29CQUNILE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO2lCQUNuQztnQkFFRCxvQ0FBb0M7Z0JBQ3BDLElBQUksT0FBTyxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ3RDLElBQUksQ0FBQyxPQUFPLEVBQUU7b0JBQ1YsT0FBTyxHQUFHLENBQUMsQ0FBQztpQkFDZjtnQkFDRCxNQUFNLGVBQWUsR0FBRyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUE7Z0JBQzdELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUUsQ0FBQztnQkFDdEUsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxlQUFlLEVBQUUsZUFBZSxHQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUVuRixJQUFJLE9BQU8sR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUMvQixJQUFJLENBQUMsT0FBTyxDQUFFLENBQUMsS0FBSyxFQUFFLEVBQUU7b0JBQ3BCLE1BQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxHQUFDLEtBQUssQ0FBQyxDQUFDO29CQUM1QyxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO29CQUMvQixNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUVoRCwwQ0FBMEM7b0JBQzFDLE9BQU8sR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEdBQUc7d0JBQ2xELENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFFNUUseUNBQXlDO29CQUN6QyxPQUFPLEdBQUcsaUJBQWlCLENBQUMsT0FBTyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztvQkFDakQsTUFBTSxVQUFVLEdBQUcsSUFBSSxXQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ25ELE9BQU8sR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQUE7b0JBQ2hELE9BQU8sR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM5QyxDQUFDLENBQUMsQ0FBQztnQkFFSCxJQUFJLE1BQU0sR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUM5QixvREFBb0Q7Z0JBQ3BELE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7Z0JBRXZELDhEQUE4RDtnQkFDOUQsTUFBTSxHQUFHLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxJQUFJLFdBQVcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUN0RSxNQUFNLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFeEMsOENBQThDO2dCQUM5QyxNQUFNLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRXBGLDhDQUE4QztnQkFDOUMsTUFBTSxHQUFHLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBRTVFLDZDQUE2QztnQkFDN0MsTUFBTSxHQUFHLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUVsRCw4Q0FBOEM7Z0JBQzlDLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRTVFLDhDQUE4QztnQkFDOUMsTUFBTSxHQUFHLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUVwRixxQkFBcUI7Z0JBQ3JCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFFbEMscUJBQXFCO2dCQUVyQixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ25DLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO2dCQUNsQixLQUFLLE1BQU0sTUFBTSxJQUFJLE9BQU8sRUFBRTtvQkFDMUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQztpQkFDMUM7Z0JBQ0QsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7Z0JBQ2xELElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUMvRDtRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVTLFNBQVMsQ0FBQyxHQUFXO1FBQzNCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7UUFFcEgsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6RCxPQUFPO1NBQ1Y7UUFFRCxJQUFHLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUNwQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pELE9BQU87U0FDVjtRQUVELElBQUcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ2xELElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekQsT0FBTztTQUNWO1FBRUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUV6RCxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVsRSxJQUFJLENBQUMsdUJBQXVCLEdBQUcsT0FBTyxDQUFDO1FBRXZDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFDM0MsRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEVBQUU7WUFDaEMsSUFBSSxHQUFHLEVBQUU7Z0JBQ0wsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsQ0FBQzthQUM3QztpQkFBTTtnQkFFSCwwRUFBMEU7Z0JBQzFFLDZCQUE2QjtnQkFDN0IsSUFBSSxPQUFPLEdBQWMsRUFBRSxDQUFDO2dCQUM1QixJQUFHLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7b0JBQ3pELHFDQUFxQztvQkFDckMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztpQkFDckI7Z0JBQ0QsSUFBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEtBQUssS0FBSyxFQUFFO29CQUN2QyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUU7d0JBQ25CLElBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFOzRCQUN0QixPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO3lCQUN0QjtvQkFDTCxDQUFDLENBQUMsQ0FBQztpQkFDTjtxQkFBTTtvQkFDSCxPQUFPLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDbkM7Z0JBRUQsb0NBQW9DO2dCQUNwQyxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUM7Z0JBQ2xCLE1BQU0sZUFBZSxHQUFHLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQTtnQkFDN0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBRSxDQUFDO2dCQUNwRSxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLGVBQWUsRUFBRSxlQUFlLEdBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7Z0JBRWpGLElBQUksTUFBTSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQzlCLG9EQUFvRDtnQkFDcEQsTUFBTSxHQUFHLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQztnQkFFdkQsOERBQThEO2dCQUM5RCxNQUFNLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxFQUFFLElBQUksV0FBVyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUM7Z0JBQzNGLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUV4Qyw4Q0FBOEM7Z0JBQzlDLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFaEYsOENBQThDO2dCQUM5QyxNQUFNLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFFNUUsNkNBQTZDO2dCQUM3QyxNQUFNLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBRWxELDhDQUE4QztnQkFDOUMsTUFBTSxHQUFHLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFNUUscUJBQXFCO2dCQUNyQixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7YUFFckM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFUyxRQUFRLENBQUMsSUFBWTtRQUMzQixJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQWUsaURBQWlEO1FBRXpHLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUVqRyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDYixJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUNuRCxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDM0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3JELE9BQU87U0FDVjtRQUVELElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDL0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQzFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNyRCxPQUFPO1NBQ1Y7UUFFRCxHQUFHLENBQUMsV0FBVyxPQUFPLElBQUksQ0FBQyxDQUFDO1FBRTVCLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFbkMsSUFBSSxLQUFLLENBQUMsSUFBSSxHQUFHLGFBQWEsRUFBRTtZQUM1QixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQztZQUM5QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDckQsT0FBTztTQUNWO1FBRUQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV4QyxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsR0FBRyxFQUFFO1lBQ3ZCLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixDQUFDLENBQUM7WUFDMUMsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBUSxPQUFPO1lBQ2hDLE9BQU87U0FDVjtRQUVELElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUErQixrQkFBa0I7UUFDMUUsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBdUMsa0JBQWtCO1FBQzFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFUyxpQkFBaUIsQ0FBQyxRQUFnQixFQUFFLE9BQWUsRUFBRSxLQUFVO1FBQ3JFLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUM7UUFDdEQsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFFbEIsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFHLENBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxFQUFFO1lBQy9CLElBQUksR0FBRyxFQUFFO2dCQUNMLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixDQUFDLENBQUM7YUFDN0M7aUJBQU07Z0JBQ0gsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7Z0JBQ3JCLHNCQUFzQjtnQkFDdEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUM7b0JBQ3RDLDRCQUE0QjtvQkFDNUIsZ0JBQWdCO29CQUNoQiw2QkFBNkI7b0JBQzdCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztvQkFDekYsNkJBQTZCO29CQUM3QixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsSUFBSSxFQUFFLENBQUM7b0JBQ2pILDZCQUE2QjtvQkFDN0IsSUFBSSxDQUFDLFNBQVMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQztpQkFDOUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ0osNEJBQTRCO2dCQUM1QixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBRXBDLDJCQUEyQjtnQkFDM0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDbkQ7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFUyxhQUFhO1FBQ25CLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ2xCLElBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO1FBRWpCLElBQUcsSUFBSSxDQUFDLEtBQUssR0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQzVCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUNoQyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFPLDZDQUE2QztTQUN4RTtRQUVELEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFHLElBQUksRUFBRyxDQUFDLEdBQUcsRUFBRSxTQUFTLEVBQUUsRUFBRTtZQUNuRixJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFO2dCQUM1QixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO2FBQzdDO2lCQUFNLElBQUksR0FBRyxFQUFFO2dCQUNaLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixDQUFDLENBQUM7YUFDN0M7aUJBQU07Z0JBQ0gsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxFQUFFLEVBQUU7b0JBQ3JDLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUNyRDtnQkFDRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztnQkFDbEQsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2FBQ3BCO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRVMsU0FBUztRQUNmLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDbkUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2hFLENBQUM7Q0FDSiJ9