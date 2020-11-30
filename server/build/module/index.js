// tslint:disable:no-console
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { env } from 'process';
import { log } from './lib/Logger';
import { Session } from './lib/Session';
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
};
// 'connection' listener.
const server = net.createServer((socket) => {
    log('Client connected');
    socket.on('end', () => {
        log('Socket closed');
    });
});
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsNEJBQTRCO0FBQzVCLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFBO0FBQ3hCLE9BQU8sS0FBSyxHQUFHLE1BQU0sS0FBSyxDQUFBO0FBQzFCLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFBO0FBQzVCLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxTQUFTLENBQUE7QUFDN0IsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUNuQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sZUFBZSxDQUFBO0FBRXZDLE1BQU0sYUFBYSxHQUFHO0lBQ3BCLE9BQU8sRUFBRSxHQUFHO0lBQ1osUUFBUSxFQUFFLFFBQVE7SUFDbEIsRUFBRSxFQUFFLFNBQVM7SUFDYixJQUFJLEVBQUUsS0FBSztJQUNYLEtBQUssRUFBRSxJQUFJO0NBQ1osQ0FBQztBQUVGLE1BQU0sU0FBUyxHQUFHLENBQUMsU0FBaUIsRUFBTyxFQUFFO0lBQzNDLElBQUcsR0FBRyxDQUFDLE9BQU8sU0FBUyxFQUFFLENBQUMsRUFBRTtRQUMxQixPQUFPLEdBQUcsQ0FBQyxPQUFPLFNBQVMsRUFBRSxDQUFDLENBQUM7S0FDaEM7SUFFRCxPQUFPLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNsQyxDQUFDLENBQUM7QUFFRixNQUFNLFNBQVMsR0FBRyxDQUFDLFFBQWdCLEVBQU8sRUFBRTtJQUMxQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7SUFFbkQsSUFBRyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLEVBQUU7UUFDN0IsR0FBRyxDQUFDLHVCQUF1QixVQUFVLGtCQUFrQixDQUFDLENBQUM7UUFDekQsT0FBTyxDQUFDLElB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