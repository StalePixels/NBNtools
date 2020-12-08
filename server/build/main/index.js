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
// tslint:disable:no-console
const fs = __importStar(require("fs"));
const net = __importStar(require("net"));
const path = __importStar(require("path"));
const process_1 = require("process");
const Logger_1 = require("./lib/Logger");
const Session_1 = require("./lib/Session");
const defaultConfig = {
    BACKLOG: 128,
    FILEPATH: 'public',
    IP: '0.0.0.0',
    PORT: 48128,
    RETRY: 1000,
    SHOWDOTS: false
};
const getConfig = (paramName) => {
    if (process_1.env[`NBN_${paramName}`]) {
        return process_1.env[`NBN_${paramName}`];
    }
    return defaultConfig[paramName];
};
const checkPath = (userPath) => {
    const publicPath = path.resolve(userPath);
    if (!fs.existsSync(publicPath)) {
        Logger_1.log(`ERROR: public path (${publicPath}) does not exist`);
        process.exit(-1);
    }
    return publicPath;
};
const config = {
    BACKLOG: getConfig("BACKLOG"),
    FILEPATH: checkPath(getConfig('FILEPATH')),
    IP: getConfig("IP"),
    PORT: getConfig("PORT"),
    RETRY: getConfig("RETRY"),
    SHOWDOTS: getConfig("SHOWDOTS"),
};
// 'connection' listener.
const server = net.createServer((socket) => {
    Logger_1.log('Client connected');
    socket.on('end', () => {
        Logger_1.log('Socket closed');
    });
});
(async () => {
    server.listen(config.PORT, config.IP, config.BACKLOG)
        // Unexpected Error handler
        .on('error', (e) => {
        // @ts-ignore
        if (e.code === 'EADDRINUSE') {
            Logger_1.log(`Address in use ${config.IP}:${config.PORT} -  retrying in ${config.RETRY}ms...`);
            setTimeout(() => {
                server.close();
                server.listen(config.PORT, config.IP);
            }, config.RETRY);
        }
    })
        // Bound to socket
        .on('listening', () => {
        Logger_1.log(`Server listening on ${config.IP}:${config.PORT} serving from "${config.FILEPATH}" `);
    })
        // Connection Listener
        .on('connection', socket => {
        new Session_1.Session(socket, config);
    })
        // Connection Cleanup
        .on('end', socket => {
        Logger_1.log(`Server ended connection from ${socket.remoteAddress}:${socket.remotePort}`);
    })
        .on('error', (err) => {
        Logger_1.log(`throw ${err}`);
    });
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsNEJBQTRCO0FBQzVCLHVDQUF3QjtBQUN4Qix5Q0FBMEI7QUFDMUIsMkNBQTRCO0FBQzVCLHFDQUE2QjtBQUM3Qix5Q0FBbUM7QUFDbkMsMkNBQXVDO0FBRXZDLE1BQU0sYUFBYSxHQUFHO0lBQ3BCLE9BQU8sRUFBRSxHQUFHO0lBQ1osUUFBUSxFQUFFLFFBQVE7SUFDbEIsRUFBRSxFQUFFLFNBQVM7SUFDYixJQUFJLEVBQUUsS0FBSztJQUNYLEtBQUssRUFBRSxJQUFJO0lBQ1gsUUFBUSxFQUFFLEtBQUs7Q0FDaEIsQ0FBQztBQUVGLE1BQU0sU0FBUyxHQUFHLENBQUMsU0FBaUIsRUFBTyxFQUFFO0lBQzNDLElBQUcsYUFBRyxDQUFDLE9BQU8sU0FBUyxFQUFFLENBQUMsRUFBRTtRQUMxQixPQUFPLGFBQUcsQ0FBQyxPQUFPLFNBQVMsRUFBRSxDQUFDLENBQUM7S0FDaEM7SUFFRCxPQUFPLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNsQyxDQUFDLENBQUM7QUFFRixNQUFNLFNBQVMsR0FBRyxDQUFDLFFBQWdCLEVBQU8sRUFBRTtJQUMxQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRTFDLElBQUcsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxFQUFFO1FBQzdCLFlBQUcsQ0FBQyx1QkFBdUIsVUFBVSxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3pELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNsQjtJQUVELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUMsQ0FBQztBQUVGLE1BQU0sTUFBTSxHQUFHO0lBQ2IsT0FBTyxFQUFFLFNBQVMsQ0FBQyxTQUFTLENBQUM7SUFDN0IsUUFBUSxFQUFFLFNBQVMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDMUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUM7SUFDbkIsSUFBSSxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUM7SUFDdkIsS0FBSyxFQUFFLFNBQVMsQ0FBQyxPQUFPLENBQUM7SUFDekIsUUFBUSxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUM7Q0FDaEMsQ0FBQztBQUVGLHlCQUF5QjtBQUN6QixNQUFNLE1BQU0sR0FBSSxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7SUFDMUMsWUFBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFFeEIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFO1FBQ3BCLFlBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUN2QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBRUgsQ0FBQyxLQUFLLElBQUksRUFBRTtJQUNWLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUM7UUFDakQsMkJBQTJCO1NBQzFCLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRTtRQUNqQixhQUFhO1FBQ2IsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLFlBQVksRUFBRTtZQUMzQixZQUFHLENBQUMsa0JBQWtCLE1BQU0sQ0FBQyxFQUFFLElBQUksTUFBTSxDQUFDLElBQUksbUJBQW1CLE1BQU0sQ0FBQyxLQUFLLE9BQU8sQ0FBQyxDQUFDO1lBQ3RGLFVBQVUsQ0FBQyxHQUFHLEVBQUU7Z0JBQ2QsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNmLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDeEMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNsQjtJQUNILENBQUMsQ0FBQztRQUVGLGtCQUFrQjtTQUNqQixFQUFFLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRTtRQUNwQixZQUFHLENBQUMsdUJBQXVCLE1BQU0sQ0FBQyxFQUFFLElBQUksTUFBTSxDQUFDLElBQUksa0JBQWtCLE1BQU0sQ0FBQyxRQUFRLElBQUksQ0FBQyxDQUFDO0lBQzVGLENBQUMsQ0FBQztRQUVGLHNCQUFzQjtTQUNyQixFQUFFLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxFQUFFO1FBQ3pCLElBQUksaUJBQU8sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDOUIsQ0FBQyxDQUFDO1FBRUYscUJBQXFCO1NBQ3BCLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEVBQUU7UUFDbEIsWUFBRyxDQUFDLGdDQUFnQyxNQUFNLENBQUMsYUFBYSxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQ25GLENBQUMsQ0FBQztTQUVELEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUNmLFlBQUcsQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDdEIsQ0FBQyxDQUNKLENBQUM7QUFDUixDQUFDLENBQUMsRUFBRSxDQUFDIn0=