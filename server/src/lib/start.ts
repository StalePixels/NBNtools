import * as net from 'node:net';
import { loadConfig } from './Config.js';
import { log } from './Logger.js';
import { Session, type ServerClass } from './Session.js';

export const startServer = (ServerType: ServerClass): net.Server => {
  const config = loadConfig();

  // 'connection' listener.
  const server  = net.createServer((socket) => {
    log('Client connected');

    socket.on('end', () => {
      log('Socket closed');
    });
  });

  server.listen(config.PORT, config.IP, config.BACKLOG)
      // Unexpected Error handler
      .on('error', (e: NodeJS.ErrnoException) => {
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
        new Session(socket, config, ServerType);
      })

      .on('error', (err) => {
            log(`throw ${err}`);
          }
      );

  return server;
};
