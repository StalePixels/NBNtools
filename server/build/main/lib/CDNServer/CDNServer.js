"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDNServer = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const Logger_1 = require("../Logger");
const PersonalServer_1 = require("../PersonalServer");
const MAX_MOTD_SIZE = 4096;
class CDNServer extends PersonalServer_1.PersonalServer {
    constructor(session) {
        super(session);
    }
    command(cmd, params) {
        Logger_1.log("CDNServer COMMAND " + cmd + " WITH " + params);
        switch (cmd) {
            case "MOTD":
                this.motd();
                break;
            default:
                super.command(cmd, params);
        }
    }
    motd() {
        this.block = 0;
        this.blockSize = this.preferredBlockSize; // Variable blocksize, we shorten the last to fit
        const absFile = path_1.default.resolve(this.session.config.FILEPATH + this.currentWorkingDirectory + ".motd");
        if (!fs_1.default.existsSync(absFile)) {
            this.session.socket.write("NoMOTD_ERROR");
            this.session.socket.write(Uint8Array.from([13, 10]));
            return;
        }
        Logger_1.log(`MOTD serving ${absFile}" `);
        const stats = fs_1.default.statSync(absFile);
        if (stats.size > MAX_MOTD_SIZE) {
            this.session.socket.write("NoMOTD_ERROR");
            this.session.socket.write(Uint8Array.from([13, 10]));
            return;
        }
        const filename = path_1.default.basename(absFile);
        this.session.state = "S"; // Flag in session
        this.state = "S"; // Flag in handler
        this.sendFileDangerous(filename, absFile, stats);
    }
}
exports.CDNServer = CDNServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ0ROU2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9DRE5TZXJ2ZXIvQ0ROU2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLDRDQUFvQjtBQUNwQixnREFBd0I7QUFDeEIsc0NBQWdDO0FBQ2hDLHNEQUFtRDtBQUduRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUM7QUFFM0IsTUFBYSxTQUFVLFNBQVEsK0JBQWM7SUFDekMsWUFBWSxPQUFnQjtRQUN4QixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDbkIsQ0FBQztJQUVNLE9BQU8sQ0FBQyxHQUFXLEVBQUUsTUFBeUI7UUFDakQsWUFBRyxDQUFDLG9CQUFvQixHQUFDLEdBQUcsR0FBQyxRQUFRLEdBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUMsUUFBUSxHQUFHLEVBQUU7WUFDVCxLQUFLLE1BQU07Z0JBQ1AsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNaLE1BQU07WUFDVjtnQkFDSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztTQUNsQztJQUNMLENBQUM7SUFFUyxJQUFJO1FBQ1YsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFlLGlEQUFpRDtRQUV6RyxNQUFNLE9BQU8sR0FBRyxjQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsdUJBQXVCLEdBQUcsT0FBTyxDQUFDLENBQUM7UUFFcEcsSUFBSSxDQUFDLFlBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQzFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNyRCxPQUFPO1NBQ1Y7UUFFRCxZQUFHLENBQUMsZ0JBQWdCLE9BQU8sSUFBSSxDQUFDLENBQUM7UUFFakMsTUFBTSxLQUFLLEdBQUcsWUFBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVuQyxJQUFJLEtBQUssQ0FBQyxJQUFJLEdBQUcsYUFBYSxFQUFFO1lBQzVCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUMxQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDckQsT0FBTztTQUNWO1FBRUQsTUFBTSxRQUFRLEdBQUcsY0FBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV4QyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBK0Isa0JBQWtCO1FBQzFFLElBQUksQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLENBQXVDLGtCQUFrQjtRQUMxRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNyRCxDQUFDO0NBRUo7QUE3Q0QsOEJBNkNDIn0=