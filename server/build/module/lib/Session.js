import { TextEncoder } from "util";
// import {CDNServer as Server} from './CDNServer/CDNServer';
import { PersonalServer as Server } from './PersonalServer';
import { log } from './Logger';
function concatTypedArrays(a, b) {
    const c = new (a.constructor)(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
}
export class Session {
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
        this.server = new Server(this);
        this.state = "W"; // WAITING for command
        log(Server);
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
                log(`Dispatching COMMAND: "${cmd}" PARAMS: `, params, " to NBNServer");
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
        log(`Session disconnected from ${this.socket.remoteAddress}:${this.socket.remotePort} for ${message}`);
        const error = new TextEncoder().encode(message);
        this.socket.write(concatTypedArrays(error, Uint8Array.from([13, 10])));
        this.socket.end();
        delete this.socket;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2Vzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvU2Vzc2lvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ25DLDZEQUE2RDtBQUM3RCxPQUFPLEVBQUUsY0FBYyxJQUFJLE1BQU0sRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQzVELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFFL0IsU0FBUyxpQkFBaUIsQ0FBQyxDQUFNLEVBQUUsQ0FBTTtJQUN2QyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ25ELENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ1osQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ25CLE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQUVELE1BQU0sT0FBTyxPQUFPO0lBT2xCLFlBQVksTUFBa0IsRUFBRSxNQUFXO1FBQ3pDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBRXJCOzs7Ozs7Ozs7V0FTRztRQUNILElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBTyxzQkFBc0I7UUFFOUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRVosMEJBQTBCO1FBQzFCLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDM0IsMkVBQTJFO1lBQzNFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDcEIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU0sSUFBSSxDQUFDLE1BQWM7UUFDeEIsUUFBTyxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ2pCLEtBQUssR0FBRyxFQUFNLHNCQUFzQjtnQkFDbEMscUJBQXFCO2dCQUNyQixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQTBCLFlBQVk7cUJBQy9ELE9BQU8sQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDLENBQUUsbUJBQW1CO3FCQUM5QyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBOEIsaUJBQWlCO2dCQUMvRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBc0IsWUFBWTtnQkFDcEUsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUEwQixrQ0FBa0M7Z0JBQzFGLEdBQUcsQ0FBQyx5QkFBeUIsR0FBRyxZQUFZLEVBQUUsTUFBTSxFQUFFLGVBQWUsQ0FBQyxDQUFDO2dCQUV2RSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBRWpDLE1BQU07WUFDUixLQUFLLEdBQUcsRUFBTSwyQ0FBMkM7Z0JBQ3JELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUMzQixNQUFNO1lBQ1I7Z0JBQ0UsTUFBTTtTQUNUO1FBRUQsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFHLEdBQUcsRUFBRTtZQUNwQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7U0FDcEI7SUFDSCxDQUFDO0lBRU0sR0FBRyxDQUFDLE9BQWU7UUFDeEIsR0FBRyxDQUFDLDZCQUE2QixJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsUUFBUSxPQUFPLEVBQUUsQ0FBRSxDQUFDO1FBRXhHLE1BQU0sS0FBSyxHQUFHLElBQUksV0FBVyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRXRFLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDbEIsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3JCLENBQUM7Q0FFRiJ9