// tslint:disable:no-console
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import 'process';
import { log } from './lib/Logger';
import { Session } from './lib/Session';
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
        log(`ERROR: public path (${publicPath}) does not exist`);
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
    log('Client connected');
    socket.on('end', () => {
        log('Socket closed');
    });
});
(async () => {
    server.listen(config.PORT, config.IP, config.BACKLOG)
        // Unexpected Error handler
        .on('error', (e) => {
        // @ts-ignore
        if (e.code === 'EADDRINUSE') {
            log(`Address in use ${config.IP}:${config.PORT} -  retrying in ${config.RETRY}ms...`);
            setTimeout(() => {
                server.close();
                server.listen(config.PORT, config.IP);
            }, config.RETRY);
        }
    })
        // Bound to socket
        .on('listening', () => {
        log(`Server listening on ${config.IP}:${config.PORT} serving from "${config.FILEPATH}" `);
    })
        // Connection Listener
        .on('connection', socket => {
        new Session(socket, config);
    })
        // Connection Cleanup
        .on('end', socket => {
        log(`Server ended connection from ${socket.remoteAddress}:${socket.remotePort}`);
    })
        .on('error', (err) => {
        log(`throw ${err}`);
    });
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsNEJBQTRCO0FBQzVCLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFBO0FBQ3hCLE9BQU8sS0FBSyxHQUFHLE1BQU0sS0FBSyxDQUFBO0FBQzFCLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFBO0FBQzVCLE9BQU8sU0FBUyxDQUFBO0FBRWhCLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDbkMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGVBQWUsQ0FBQTtBQUV2QyxNQUFNLGFBQWEsR0FBRztJQUNwQixPQUFPLEVBQUUsR0FBRztJQUNaLFFBQVEsRUFBRSxRQUFRO0lBQ2xCLEVBQUUsRUFBRSxTQUFTO0lBQ2IsSUFBSSxFQUFFLEtBQUs7SUFDWCxLQUFLLEVBQUUsSUFBSTtJQUNYLFFBQVEsRUFBRSxLQUFLO0NBQ2hCLENBQUM7QUFFRixNQUFNLFNBQVMsR0FBRyxDQUFDLFNBQWlCLEVBQU8sRUFBRTtJQUMzQyxJQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxTQUFTLEVBQUUsQ0FBQyxFQUFFO1FBQ2xDLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLFNBQVMsRUFBRSxDQUFDLENBQUM7S0FDeEM7SUFFRCxPQUFPLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNsQyxDQUFDLENBQUM7QUFFRixNQUFNLFNBQVMsR0FBRyxDQUFDLFFBQWdCLEVBQU8sRUFBRTtJQUMxQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRTFDLElBQUcsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxFQUFFO1FBQzdCLEdBQUcsQ0FBQyx1QkFBdUIsVUFBVSxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3pELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNsQjtJQUVELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUMsQ0FBQztBQUVGLE1BQU0sTUFBTSxHQUFHO0lBQ2IsT0FBTyxFQUFFLFNBQVMsQ0FBQyxTQUFTLENBQUM7SUFDN0IsUUFBUSxFQUFFLFNBQVMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDMUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUM7SUFDbkIsSUFBSSxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUM7SUFDdkIsS0FBSyxFQUFFLFNBQVMsQ0FBQyxPQUFPLENBQUM7SUFDekIsUUFBUSxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUM7Q0FDaEMsQ0FBQztBQUVGLDBCQUEwQjtBQUMxQixPQUFPO0tBQ0YsRUFBRSxDQUFDLG9CQUFvQixFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0lBQ3BDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLGdDQUFnQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQy9ELENBQUMsQ0FBQztLQUNELEVBQUUsQ0FBQyxtQkFBbUIsRUFBRSxHQUFHLENBQUMsRUFBRTtJQUMzQixPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSwyQkFBMkIsQ0FBQyxDQUFDO0FBQ3BELENBQUMsQ0FBQyxDQUFDO0FBR1AseUJBQXlCO0FBQ3pCLE1BQU0sTUFBTSxHQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTtJQUMxQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUV4QixNQUFNLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUU7UUFDcEIsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3ZCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFFSCxDQUFDLEtBQUssSUFBSSxFQUFFO0lBQ1YsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUNqRCwyQkFBMkI7U0FDMUIsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFO1FBQ2pCLGFBQWE7UUFDYixJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssWUFBWSxFQUFFO1lBQzNCLEdBQUcsQ0FBQyxrQkFBa0IsTUFBTSxDQUFDLEVBQUUsSUFBSSxNQUFNLENBQUMsSUFBSSxtQkFBbUIsTUFBTSxDQUFDLEtBQUssT0FBTyxDQUFDLENBQUM7WUFDdEYsVUFBVSxDQUFDLEdBQUcsRUFBRTtnQkFDZCxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ2YsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN4QyxDQUFDLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ2xCO0lBQ0gsQ0FBQyxDQUFDO1FBRUYsa0JBQWtCO1NBQ2pCLEVBQUUsQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFO1FBQ3BCLEdBQUcsQ0FBQyx1QkFBdUIsTUFBTSxDQUFDLEVBQUUsSUFBSSxNQUFNLENBQUMsSUFBSSxrQkFBa0IsTUFBTSxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUM7SUFDNUYsQ0FBQyxDQUFDO1FBRUYsc0JBQXNCO1NBQ3JCLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLEVBQUU7UUFDekIsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQzlCLENBQUMsQ0FBQztRQUVGLHFCQUFxQjtTQUNwQixFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxFQUFFO1FBQ2xCLEdBQUcsQ0FBQyxnQ0FBZ0MsTUFBTSxDQUFDLGFBQWEsSUFBSSxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUNuRixDQUFDLENBQUM7U0FFRCxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUU7UUFDZixHQUFHLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3RCLENBQUMsQ0FDSixDQUFDO0FBQ1IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyJ9