// pino's level numbers.
const LEVELS: Record<number, string> = {
    10: 'TRACE',
    20: 'DEBUG',
    30: 'INFO',
    40: 'WARN',
    50: 'ERROR',
    60: 'FATAL',
};

const two = (n: number): string => String(n).padStart(2, '0');

// One JSON line from the server's log as "HH:MM:SS LEVEL message", in local
//    time. A line that is not a pino entry comes back unchanged.
export function formatLogLine(line: string): string {
    let entry: unknown;
    try {
        entry = JSON.parse(line);
    } catch {
        return line;
    }
    if (typeof entry !== 'object' || entry === null) {
        return line;
    }
    const { level, time, msg } = entry as { level?: unknown; time?: unknown; msg?: unknown };
    if (typeof level !== 'number' || typeof time !== 'number' || typeof msg !== 'string') {
        return line;
    }
    const date = new Date(time);
    const clock = `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
    return `${clock} ${(LEVELS[level] ?? String(level)).padEnd(5)} ${msg}`;
}
