import * as net from 'node:net';
import { loadConfig } from './Config.js';
import { log } from './Logger.js';
import { Session, type ServerClass } from './Session.js';

export const startServer = (ServerType: ServerClass): net.Server => {
  const config = loadConfig();
  const perAddress = new Map<string, number>();
  let open = 0;

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
        const address = socket.remoteAddress ?? '';
        const mine = perAddress.get(address) ?? 0;
        if (open >= config.MAXCONNS || mine >= config.MAXPERIP) {
          log(`Refused ${address}: ${open} open, ${mine} from this address`);
          socket.destroy();
          return;
        }
        open++;
        perAddress.set(address, mine + 1);
        socket.on('close', () => {
          open--;
          const left = (perAddress.get(address) ?? 1) - 1;
          if (left > 0) {
            perAddress.set(address, left);
          } else {
            perAddress.delete(address);
          }
        });
        // No message: an ESP8266 in passthrough mode connects again by itself, and a
        //    message would wait in the Next's UART until its next request.
        socket.setTimeout(config.IDLE, () => {
          log(`Idle for ${config.IDLE}ms: ${address}:${socket.remotePort}`);
          socket.destroy();
        });
        new Session(socket, config, ServerType);
      })

      .on('error', (err) => {
            log(`throw ${err}`);
          }
      );

  return server;
};
