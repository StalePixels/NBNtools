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
require("process");
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
    if (process.env[`NBN_${paramName}`]) {
        return process.env[`NBN_${paramName}`];
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
// Log better about errors
process
    .on('unhandledRejection', (reason, p) => {
    console.error(reason, 'Unhandled Rejection at Promise', p);
})
    .on('uncaughtException', err => {
    console.error(err, 'Uncaught Exception thrown');
});
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsNEJBQTRCO0FBQzVCLHVDQUF3QjtBQUN4Qix5Q0FBMEI7QUFDMUIsMkNBQTRCO0FBQzVCLG1CQUFnQjtBQUVoQix5Q0FBbUM7QUFDbkMsMkNBQXVDO0FBRXZDLE1BQU0sYUFBYSxHQUFHO0lBQ3BCLE9BQU8sRUFBRSxHQUFHO0lBQ1osUUFBUSxFQUFFLFFBQVE7SUFDbEIsRUFBRSxFQUFFLFNBQVM7SUFDYixJQUFJLEVBQUUsS0FBSztJQUNYLEtBQUssRUFBRSxJQUFJO0lBQ1gsUUFBUSxFQUFFLEtBQUs7Q0FDaEIsQ0FBQztBQUVGLE1BQU0sU0FBUyxHQUFHLENBQUMsU0FBaUIsRUFBTyxFQUFFO0lBQzNDLElBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLFNBQVMsRUFBRSxDQUFDLEVBQUU7UUFDbEMsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sU0FBUyxFQUFFLENBQUMsQ0FBQztLQUN4QztJQUVELE9BQU8sYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ2xDLENBQUMsQ0FBQztBQUVGLE1BQU0sU0FBUyxHQUFHLENBQUMsUUFBZ0IsRUFBTyxFQUFFO0lBQzFDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFMUMsSUFBRyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLEVBQUU7UUFDN0IsWUFBRyxDQUFDLHVCQUF1QixVQUFVLGtCQUFrQixDQUFDLENBQUM7UUFDekQsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2xCO0lBRUQsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQyxDQUFDO0FBRUYsTUFBTSxNQUFNLEdBQUc7SUFDYixPQUFPLEVBQUUsU0FBUyxD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