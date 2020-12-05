// tslint:disable:no-console
import * as fs from 'fs'
import * as net from 'net'
import * as path from 'path'
import { env } from 'process'
import { log } from './lib/Logger';
import { Session } from './lib/Session'

const defaultConfig = {
  BACKLOG: 128,
  FILEPATH: 'public',
  IP: '0.0.0.0',
  PORT: 48128,
  RETRY: 1000,
};

const getConfig = (paramName: string): any => {
  if(env[`NBN_${paramName}`]) {
    return env[`NBN_${paramName}`];
  }

  return defaultConfig[paramName];
};

const checkPath = (userPath: string): any => {
  const publicPath = path.resolve(userPath);

  if(!fs.existsSync(publicPath)) {
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
const server  = net.createServer((socket) => {
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
      log(`Server ended connection from ${socket.remoteAddress}:${socket.remotePort}` );
    })

    .on('error', (err) => {
      log(`throw ${err}`);
    }
);
