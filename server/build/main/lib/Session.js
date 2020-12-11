"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const util_1 = require("util");
// This is now the "correct" way to do this, we no longer call PersonalServer
// -- CDNServer handles the CDN/Personal seperation via git sub-modules
const CDNServer_1 = require("./CDNServer/CDNServer");
// This allows other content servers to add additional features (such as Authentication,
//    and gateways to custom/private services to the codebase, easily, without
//    breaking the licence on the open source portions of the software - or bloating the
//    base protocol.
const Logger_1 = require("./Logger");
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
        this.server = new CDNServer_1.CDNServer(this);
        this.state = "W"; // WAITING for command
        Logger_1.log(CDNServer_1.CDNServer);
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
            case "S": // data currently being SENT by (NBN)Server
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2Vzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvU2Vzc2lvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSwrQkFBbUM7QUFDbkMsNkVBQTZFO0FBQzdFLHVFQUF1RTtBQUN2RSxxREFBNEQ7QUFDNUQsd0ZBQXdGO0FBQ3hGLDhFQUE4RTtBQUM5RSx3RkFBd0Y7QUFDeEYsb0JBQW9CO0FBQ3BCLHFDQUErQjtBQUUvQixTQUFTLGlCQUFpQixDQUFDLENBQU0sRUFBRSxDQUFNO0lBQ3ZDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkQsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDWixDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkIsT0FBTyxDQUFDLENBQUM7QUFDWCxDQUFDO0FBRUQsTUFBYSxPQUFPO0lBT2xCLFlBQVksTUFBa0IsRUFBRSxNQUFXO1FBQ3pDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBRXJCOzs7Ozs7Ozs7V0FTRztRQUNILElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxxQkFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9CLElBQUksQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLENBQU8sc0JBQXNCO1FBRTlDLFlBQUcsQ0FBQyxxQkFBTSxDQUFDLENBQUM7UUFFWiwwQkFBMEI7UUFDMUIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRTtZQUMzQiwyRUFBMkU7WUFDM0UsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNwQixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTSxJQUFJLENBQUMsTUFBYztRQUN4QixRQUFPLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDakIsS0FBSyxHQUFHLEVBQU0sc0JBQXNCO2dCQUNsQyxxQkFBcUI7Z0JBQ3JCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBMEIsWUFBWTtxQkFDL0QsT0FBTyxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBRSxtQkFBbUI7cUJBQzlDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUE4QixpQkFBaUI7Z0JBQy9ELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFzQixZQUFZO2dCQUNwRSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBRSxDQUFDLENBQTBCLGtDQUFrQztnQkFDMUYsWUFBRyxDQUFDLHlCQUF5QixHQUFHLFlBQVksRUFBRSxNQUFNLEVBQUUsZUFBZSxDQUFDLENBQUM7Z0JBRXZFLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFFakMsTUFBTTtZQUNSLEtBQUssR0FBRyxFQUFNLDJDQUEyQztnQkFDckQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzNCLE1BQU07WUFDUjtnQkFDRSxNQUFNO1NBQ1Q7UUFFRCxJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUcsR0FBRyxFQUFFO1lBQ3BCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztTQUNwQjtJQUNILENBQUM7SUFFTSxHQUFHLENBQUMsT0FBZTtRQUN4QixZQUFHLENBQUMsNkJBQTZCLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxRQUFRLE9BQU8sRUFBRSxDQUFFLENBQUM7UUFFeEcsTUFBTSxLQUFLLEdBQUcsSUFBSSxrQkFBVyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRXRFLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDbEIsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3JCLENBQUM7Q0FFRjtBQXJFRCwwQkFxRUMifQ==