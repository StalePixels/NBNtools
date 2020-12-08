"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const util_1 = require("util");
// import {CDNServer as Server} from './CDNServer/CDNServer';
const PersonalServer_1 = require("./PersonalServer");
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
        this.server = new PersonalServer_1.PersonalServer(this);
        this.state = "W"; // WAITING for command
        Logger_1.log(PersonalServer_1.PersonalServer);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2Vzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvU2Vzc2lvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSwrQkFBbUM7QUFDbkMsNkRBQTZEO0FBQzdELHFEQUE0RDtBQUM1RCxxQ0FBK0I7QUFFL0IsU0FBUyxpQkFBaUIsQ0FBQyxDQUFNLEVBQUUsQ0FBTTtJQUN2QyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ25ELENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ1osQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ25CLE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQUVELE1BQWEsT0FBTztJQU9sQixZQUFZLE1BQWtCLEVBQUUsTUFBVztRQUN6QyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUVyQjs7Ozs7Ozs7O1dBU0c7UUFDSCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksK0JBQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMvQixJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFPLHNCQUFzQjtRQUU5QyxZQUFHLENBQUMsK0JBQU0sQ0FBQyxDQUFDO1FBRVosMEJBQTBCO1FBQzFCLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDM0IsMkVBQTJFO1lBQzNFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDcEIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU0sSUFBSSxDQUFDLE1BQWM7UUFDeEIsUUFBTyxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ2pCLEtBQUssR0FBRyxFQUFNLHNCQUFzQjtnQkFDbEMscUJBQXFCO2dCQUNyQixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQTBCLFlBQVk7cUJBQy9ELE9BQU8sQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDLENBQUUsbUJBQW1CO3FCQUM5QyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBOEIsaUJBQWlCO2dCQUMvRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBc0IsWUFBWTtnQkFDcEUsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUEwQixrQ0FBa0M7Z0JBQzFGLFlBQUcsQ0FBQyx5QkFBeUIsR0FBRyxZQUFZLEVBQUUsTUFBTSxFQUFFLGVBQWUsQ0FBQyxDQUFDO2dCQUV2RSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBRWpDLE1BQU07WUFDUixLQUFLLEdBQUcsRUFBTSwyQ0FBMkM7Z0JBQ3JELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUMzQixNQUFNO1lBQ1I7Z0JBQ0UsTUFBTTtTQUNUO1FBRUQsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFHLEdBQUcsRUFBRTtZQUNwQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7U0FDcEI7SUFDSCxDQUFDO0lBRU0sR0FBRyxDQUFDLE9BQWU7UUFDeEIsWUFBRyxDQUFDLDZCQUE2QixJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsUUFBUSxPQUFPLEVBQUUsQ0FBRSxDQUFDO1FBRXhHLE1BQU0sS0FBSyxHQUFHLElBQUksa0JBQVcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNoRCxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUV0RSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNyQixDQUFDO0NBRUY7QUFyRUQsMEJBcUVDIn0=