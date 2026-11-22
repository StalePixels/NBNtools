import { format } from 'node:util';
import { pino } from 'pino';

type LogListener = (line: string) => void;

const listeners = new Set<LogListener>();

// pino writes each entry as one JSON line. They go to stdout, and to each
//    listener without the newline.
const output = {
    write(line: string): void {
        process.stdout.write(line);
        if (listeners.size > 0) {
            const entry = line.endsWith('\n') ? line.slice(0, -1) : line;
            for (const listener of listeners) {
                listener(entry);
            }
        }
    },
};

const logger = pino({}, output);

// Each takes the arguments console.log takes, and formats them the same way.
const log = (...msg: readonly unknown[]): void => {
    logger.info(format(...msg));
};

const logWarn = (...msg: readonly unknown[]): void => {
    logger.warn(format(...msg));
};

const logError = (...msg: readonly unknown[]): void => {
    logger.error(format(...msg));
};

// Returns a function that removes the listener.
const addLogListener = (listener: LogListener): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export { addLogListener, log, logError, logger, logWarn, type LogListener };
