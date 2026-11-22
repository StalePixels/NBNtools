import { contextBridge, ipcRenderer } from 'electron';

// The platform name, and the calls the window can make to the main process.
contextBridge.exposeInMainWorld('nbn', {
    platform: process.platform,
    getState: () => ipcRenderer.invoke('getState'),
    getAddresses: () => ipcRenderer.invoke('getAddresses'),
    chooseFolder: () => ipcRenderer.invoke('chooseFolder'),
    setSettings: (changes: unknown) => ipcRenderer.invoke('setSettings', changes),
    start: () => ipcRenderer.invoke('start'),
    stop: () => ipcRenderer.invoke('stop'),
    on: (channel: 'log' | 'status' | 'settings' | 'settingsError', listener: (value: unknown) => void) => {
        ipcRenderer.on(channel, (_event, value: unknown) => listener(value));
    },
});
