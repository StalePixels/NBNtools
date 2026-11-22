import * as fs from 'node:fs';
import * as path from 'node:path';

export type CloseAction = 'quit' | 'tray';

export interface Settings {
    folder: string;
    port: number;
    showDots: boolean;
    closeAction: CloseAction;
}

export const DEFAULT_PORT = 48128;

export const defaultSettings: Settings = {
    folder: '',
    port: DEFAULT_PORT,
    showDots: false,
    closeAction: 'quit',
};

const SETTINGS_FILE = 'settings.json';

export function isValidPort(port: unknown): port is number {
    return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535;
}

// Keeps each known setting that has the right type, and the default for the rest.
export function cleanSettings(raw: unknown): Settings {
    const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    return {
        folder: typeof input.folder === 'string' ? input.folder : defaultSettings.folder,
        port: isValidPort(input.port) ? input.port : defaultSettings.port,
        showDots: typeof input.showDots === 'boolean' ? input.showDots : defaultSettings.showDots,
        closeAction: input.closeAction === 'tray' || input.closeAction === 'quit'
            ? input.closeAction : defaultSettings.closeAction,
    };
}

// A missing or broken file gives the defaults.
export function loadSettings(dir: string): Settings {
    try {
        return cleanSettings(JSON.parse(fs.readFileSync(path.join(dir, SETTINGS_FILE), 'utf8')));
    } catch {
        return { ...defaultSettings };
    }
}

// Writes a new file, then renames it over the old one, so a crash cannot
//    leave half a file.
export function saveSettings(dir: string, settings: Settings): void {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, SETTINGS_FILE);
    const temp = `${file}.new`;
    fs.writeFileSync(temp, JSON.stringify(cleanSettings(settings), null, 2) + '\n');
    fs.renameSync(temp, file);
}
