import { TextEncoder } from "util";
import { log } from './Logger';
// import { NBNServer } from './NBNServer/NBNServer';
import { PersonalServer } from './PersonalServer';
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
        this.server = new PersonalServer(this);
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
                log(`Dispatching COMMAND: "${cmd}" PARAMS: `, params, " to NBNServer");
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
        log(`Session disconnected from ${this.socket.remoteAddress}:${this.socket.remotePort} for ${message}`);
        const error = new TextEncoder().encode(message);
        this.socket.write(concatTypedArrays(error, Uint8Array.from([13, 10])));
        this.socket.end();
        delete this.socket;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2Vzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvU2Vzc2lvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ25DLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFDN0IscURBQXFEO0FBQ3JELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUVsRCxTQUFTLGlCQUFpQixDQUFDLENBQU0sRUFBRSxDQUFNO0lBQ3ZDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkQsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDWixDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkIsT0FBTyxDQUFDLENBQUM7QUFDWCxDQUFDO0FBRUQsTUFBTSxPQUFPLE9BQU87SUFPbEIsWUFBWSxNQUFrQixFQUFFLE1BQVc7UUFDekMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFFckI7Ozs7Ozs7OztXQVNHO1FBQ0gsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFPLHNCQUFzQjtRQUU5QywwQkFBMEI7UUFDMUIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRTtZQUMzQiwyRUFBMkU7WUFDM0UsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNwQixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTSxJQUFJLENBQUMsTUFBYztRQUN4QixRQUFPLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDakIsS0FBSyxHQUFHLEVBQU0sc0JBQXNCO2dCQUNsQyxxQkFBcUI7Z0JBQ3JCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBMEIsWUFBWTtxQkFDL0QsT0FBTyxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBRSxtQkFBbUI7cUJBQzlDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUE4QixpQkFBaUI7Z0JBQy9ELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFzQixZQUFZO2dCQUNwRSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBRSxDQUFDLENBQTBCLGtDQUFrQztnQkFDMUYsR0FBRyxDQUFDLHlCQUF5QixHQUFHLFlBQVksRUFBRSxNQUFNLEVBQUUsZUFBZSxDQUFDLENBQUM7Z0JBRXZFLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFFakMsTUFBTTtZQUNSLEtBQUssR0FBRyxFQUFNLHNCQUFzQjtnQkFDaEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzNCLE1BQU07WUFDUjtnQkFDRSxNQUFNO1NBQ1Q7UUFFRCxJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUcsR0FBRyxFQUFFO1lBQ3BCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztTQUNwQjtJQUNILENBQUM7SUFFTSxHQUFHLENBQUMsT0FBZTtRQUN4QixHQUFHLENBQUMsNkJBQTZCLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxRQUFRLE9BQU8sRUFBRSxDQUFFLENBQUM7UUFFeEcsTUFBTSxLQUFLLEdBQUcsSUFBSSxXQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDaEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFdEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNsQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDckIsQ0FBQztDQUVGIn0=