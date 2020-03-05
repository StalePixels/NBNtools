"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-console
const fs = __importStar(require("fs"));
const env = __importStar(require("process"));
const net = __importStar(require("net"));
const path = __importStar(require("path"));
const Logger_1 = require("./lib/Logger");
const Session_1 = require("./lib/Session");
const defaultConfig = {
    BACKLOG: 128,
    FILEPATH: 'public',
    IP: '0.0.0.0',
    PORT: 48128,
    RETRY: 1000,
};
const getConfig = (paramName) => {
    if (env[`NBN_${paramName}`]) {
        return env[`NBN_${paramName}`];
    }
    return defaultConfig[paramName];
};
const checkPath = (userPath) => {
    const publicPath = path.resolve(userPath) + path.sep;
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
};
// 'connection' listener.
const server = net.createServer((socket) => {
    Logger_1.log('nbnget connected');
    socket.on('end', () => {
        Logger_1.log('Socket closed');
    });
});
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
    // @ts-ignore
    const session = new Session_1.Session(socket, config);
})
    // Connection Cleanup
    .on('end', socket => {
    Logger_1.log(`Server ended connection from ${socket.remoteAddress}:${socket.remotePort}`);
})
    .on('error', (err) => {
    Logger_1.log(`throw ${err}`);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsNEJBQTRCO0FBQzVCLHVDQUF3QjtBQUN4Qiw2Q0FBOEI7QUFDOUIseUNBQTBCO0FBQzFCLDJDQUE0QjtBQUM1Qix5Q0FBbUM7QUFDbkMsMkNBQXVDO0FBRXZDLE1BQU0sYUFBYSxHQUFHO0lBQ3BCLE9BQU8sRUFBRSxHQUFHO0lBQ1osUUFBUSxFQUFFLFFBQVE7SUFDbEIsRUFBRSxFQUFFLFNBQVM7SUFDYixJQUFJLEVBQUUsS0FBSztJQUNYLEtBQUssRUFBRSxJQUFJO0NBQ1osQ0FBQztBQUVGLE1BQU0sU0FBUyxHQUFHLENBQUMsU0FBaUIsRUFBTyxFQUFFO0lBQzNDLElBQUcsR0FBRyxDQUFDLE9BQU8sU0FBUyxFQUFFLENBQUMsRUFBRTtRQUMxQixPQUFPLEdBQUcsQ0FBQyxPQUFPLFNBQVMsRUFBRSxDQUFDLENBQUM7S0FDaEM7SUFFRCxPQUFPLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNsQyxDQUFDLENBQUM7QUFFRixNQUFNLFNBQVMsR0FBRyxDQUFDLFFBQWdCLEVBQU8sRUFBRTtJQUMxQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7SUFFbkQsSUFBRyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLEVBQUU7UUFDN0IsWUFBRyxDQUFDLHVCQUF1QixVQUFVLGtCQUFrQixDQUFDLENBQUM7UUFDekQsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2xCO0lBRUQsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQyxDQUFDO0FBRUYsTUFBTSxNQUFNLEdBQUc7SUFDYixPQUFPLEVBQUUsU0FBUyxDQUFDLFNBQVMsQ0FBQztJQUM3QixRQUFRLEVBQUUsU0FBUyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMxQyxFQUFFLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQztJQUNuQixJQUFJLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQztJQUN2QixLQUFLLEVBQUUsU0FBUyxDQUFDLE9BQU8sQ0FBQztDQUMxQixDQUFDO0FBRUYseUJBQXlCO0FBQ3pCLE1BQU0sTUFBTSxHQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTtJQUMxQyxZQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUV4QixNQUFNLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUU7UUFDcEIsWUFBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3ZCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFFSCxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDO0lBQ25ELDJCQUEyQjtLQUMxQixFQUFFLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUU7SUFDakIsYUFBYTtJQUNiLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxZQUFZLEVBQUU7UUFDM0IsWUFBRyxDQUFDLGtCQUFrQixNQUFNLENBQUMsRUFBRSxJQUFJLE1BQU0sQ0FBQyxJQUFJLG1CQUFtQixNQUFNLENBQUMsS0FBSyxPQUFPLENBQUMsQ0FBQztRQUN0RixVQUFVLENBQUMsR0FBRyxFQUFFO1lBQ2QsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2YsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN4QyxDQUFDLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ2xCO0FBQ0gsQ0FBQyxDQUFDO0lBRUYsa0JBQWtCO0tBQ2pCLEVBQUUsQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFO0lBQ3BCLFlBQUcsQ0FBQyx1QkFBdUIsTUFBTSxDQUFDLEVBQUUsSUFBSSxNQUFNLENBQUMsSUFBSSxrQkFBa0IsTUFBTSxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUM7QUFDNUYsQ0FBQyxDQUFDO0lBRUYsc0JBQXNCO0tBQ3JCLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLEVBQUU7SUFDekIsYUFBYTtJQUNiLE1BQU0sT0FBTyxHQUFHLElBQUksaUJBQU8sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDOUMsQ0FBQyxDQUFDO0lBRUEscUJBQXFCO0tBQ3BCLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEVBQUU7SUFDbEIsWUFBRyxDQUFDLGdDQUFnQyxNQUFNLENBQUMsYUFBYSxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBRSxDQUFDO0FBQ3BGLENBQUMsQ0FBQztLQUVELEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRTtJQUNuQixZQUFHLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBQ3RCLENBQUMsQ0FDSixDQUFDIn0=