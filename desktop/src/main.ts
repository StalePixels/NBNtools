import * as path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Tray } from 'electron';
import { addLogListener } from 'nbn-server';
import { lanAddresses } from './core/addresses.ts';
import { ServerController, checkFolder } from './core/controller.ts';
import { formatLogLine } from './core/logline.ts';
import { cleanSettings, loadSettings, saveSettings, type Settings } from './core/settings.ts';

const APP_NAME = 'NBN PersonalServer';
const LOG_LINES = 1000;

app.setName(APP_NAME);

// assets/ sits next to build/ in the app, and in desktop/ during development.
const asset = (name: string): string => path.join(__dirname, '..', 'assets', name);

let window: BrowserWindow | undefined;
let tray: Tray | undefined;
let quitting = false;
let settings: Settings;
let settingsError: string | undefined;
const controller = new ServerController();
const logLines: string[] = [];

function send(channel: string, value: unknown): void {
    if (window !== undefined && !window.isDestroyed()) {
        window.webContents.send(channel, value);
    }
}

addLogListener((json) => {
    const line = formatLogLine(json);
    logLines.push(line);
    if (logLines.length > LOG_LINES) {
        logLines.splice(0, logLines.length - LOG_LINES);
    }
    send('log', line);
});

controller.on('status', (status) => send('status', status));

function store(next: Settings): void {
    settings = next;
    try {
        saveSettings(app.getPath('userData'), settings);
        settingsError = undefined;
    } catch (err) {
        settingsError = `The settings could not be saved: ${(err as Error).message}`;
    }
    send('settings', settings);
    send('settingsError', settingsError ?? '');
}

function showWindow(): void {
    if (window === undefined || window.isDestroyed()) {
        createWindow();
        return;
    }
    if (process.platform === 'darwin') {
        void app.dock?.show();
    }
    window.show();
    window.focus();
}

function updateTray(): void {
    if (settings.closeAction !== 'tray') {
        tray?.destroy();
        tray = undefined;
        return;
    }
    if (tray !== undefined) {
        return;
    }
    const icon = nativeImage.createFromPath(asset(process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'));
    tray = new Tray(icon);
    tray.setToolTip(APP_NAME);
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: `Open ${APP_NAME}`, click: showWindow },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
    ]));
    // Windows opens the menu on a right click only.
    tray.on('click', () => {
        if (process.platform === 'win32') {
            showWindow();
        }
    });
}

function createWindow(): void {
    const win = new BrowserWindow({
        title: APP_NAME,
        width: 680,
        height: 760,
        minWidth: 480,
        minHeight: 520,
        icon: asset('icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
        },
    });
    window = win;
    if (process.platform !== 'darwin') {
        win.removeMenu();
    }
    win.on('close', (event) => {
        if (!quitting && settings.closeAction === 'tray') {
            event.preventDefault();
            win.hide();
            if (process.platform === 'darwin') {
                app.dock?.hide();
            }
        }
    });
    win.on('closed', () => {
        window = undefined;
        if (!quitting && settings.closeAction !== 'tray') {
            app.quit();
        }
    });
    // Links never open inside the app.
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    void win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('getState', () => ({
    settings,
    settingsError: settingsError ?? '',
    folderError: settings.folder === '' ? '' : (checkFolder(settings.folder) ?? ''),
    status: controller.status,
    addresses: lanAddresses(),
    log: logLines,
}));

ipcMain.handle('getAddresses', () => lanAddresses());

ipcMain.handle('chooseFolder', async () => {
    const options: Electron.OpenDialogOptions = {
        title: 'Choose the folder to share with the Next',
        properties: ['openDirectory', 'createDirectory'],
    };
    if (settings.folder !== '' && checkFolder(settings.folder) === undefined) {
        options.defaultPath = settings.folder;
    }
    const result = window !== undefined
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options);
    const folder = result.filePaths[0];
    if (!result.canceled && folder !== undefined) {
        store({ ...settings, folder });
    }
    return settings;
});

ipcMain.handle('setSettings', (_event, changes: unknown) => {
    const next = cleanSettings({ ...settings, ...(typeof changes === 'object' ? changes : {}) });
    // The folder changes only through chooseFolder.
    next.folder = settings.folder;
    store(next);
    updateTray();
    return settings;
});

ipcMain.handle('start', () => controller.start({
    folder: settings.folder,
    port: settings.port,
    showDots: settings.showDots,
}));

ipcMain.handle('stop', () => controller.stop());

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', showWindow);
    app.on('before-quit', () => {
        quitting = true;
        void controller.stop();
    });
    app.on('window-all-closed', () => {
        // Keeps running in the tray or menu bar. createWindow() quits the app
        //    when closing the window means quit.
    });
    app.on('activate', showWindow);
    void app.whenReady().then(() => {
        settings = loadSettings(app.getPath('userData'));
        updateTray();
        createWindow();
    });
}
