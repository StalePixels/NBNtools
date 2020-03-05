"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const Logger_1 = require("./Logger");
const PersonalServer_1 = require("./PersonalServer");
function concatTypedArrays(a, b) {
    const c = new (a.constructor)(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
}
class Session {
    constructor(socket, config) {
        this.config = config;
        this.socket = socket;
        //    this.server = new NBNServer(this);
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
        this.server = new PersonalServer_1.PersonalServer(this);
        this.state = "W"; // WAITING for command
        // Set up socket listeners
        socket.on("data", (buffer) => {
            // retain the scope of this class, and then call the data (incoming) method
            this.data(buffer);
        });
    }
    data(buffer) {
        switch (this.state) {
            case "W": // WAITING for command
                // Parse the commands
                const cmds = buffer.toString() // As string
                    .replace(/^\s+|\s+$/g, '') // Remove CR if any
                    .split(" "); // Break at space
                const cmd = cmds[0].toUpperCase(); // Uppercase
                const params = cmds.slice(1); // Leftovers after start of string
                Logger_1.log(`Dispatching COMMAND: "${cmd}" PARAMS: `, params, " to NBNServer");
                this.server.command(cmd, params);
                break;
            case "S": // data to (NBN)Server
                this.server.data(buffer);
                break;
            default:
                break;
        }
        if (this.state === 'Q') {
            delete this.server;
        }
    }
    end(message) {
        Logger_1.log(`Session disconnected from ${this.socket.remoteAddress}:${this.socket.remotePort} for ${message}`);
        const error = new util_1.TextEncoder().encode(message);
        this.socket.write(concatTypedArrays(error, Uint8Array.from([13, 10])));
        this.socket.end();
        delete this.socket;
    }
}
exports.Session = Session;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2Vzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvU2Vzc2lvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBLCtCQUFtQztBQUNuQyxxQ0FBNkI7QUFDN0IscURBQWtEO0FBRWxELFNBQVMsaUJBQWlCLENBQUMsQ0FBTSxFQUFFLENBQU07SUFDdkMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuRCxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNaLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuQixPQUFPLENBQUMsQ0FBQztBQUNYLENBQUM7QUFFRCxNQUFhLE9BQU87SUFPbEIsWUFBWSxNQUFrQixFQUFFLE1BQVc7UUFDekMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFFekIsd0NBQXdDO1FBQ3BDOzs7Ozs7Ozs7V0FTRztRQUNILElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSwrQkFBYyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLENBQU8sc0JBQXNCO1FBRTlDLDBCQUEwQjtRQUMxQixNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFO1lBQzNCLDJFQUEyRTtZQUMzRSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVNLElBQUksQ0FBQyxNQUFjO1FBQ3hCLFFBQU8sSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNqQixLQUFLLEdBQUcsRUFBTSxzQkFBc0I7Z0JBQ2xDLHFCQUFxQjtnQkFDckIsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUF3QixZQUFZO3FCQUM3RCxPQUFPLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFBLG1CQUFtQjtxQkFDNUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQTRCLGlCQUFpQjtnQkFDN0QsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQW1CLFlBQVk7Z0JBQ2pFLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBdUIsa0NBQWtDO2dCQUN2RixZQUFHLENBQUMseUJBQXlCLEdBQUcsWUFBWSxFQUFFLE1BQU0sRUFBRSxlQUFlLENBQUMsQ0FBQztnQkFFdkUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUVqQyxNQUFNO1lBQ1IsS0FBSyxHQUFHLEVBQU0sc0JBQXNCO2dCQUNoQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDM0IsTUFBTTtZQUNSO2dCQUNFLE1BQU07U0FDVDtRQUVELElBQUksSUFBSSxDQUFDLEtBQUssS0FBRyxHQUFHLEVBQUU7WUFDcEIsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO1NBQ3BCO0lBQ0gsQ0FBQztJQUVNLEdBQUcsQ0FBQyxPQUFlO1FBQ3hCLFlBQUcsQ0FBQyw2QkFBNkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLFFBQVEsT0FBTyxFQUFFLENBQUUsQ0FBQztRQUV4RyxNQUFNLEtBQUssR0FBRyxJQUFJLGtCQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDaEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFdEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNsQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDckIsQ0FBQztDQUVGO0FBcEVELDBCQW9FQyJ9