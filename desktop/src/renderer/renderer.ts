import type { NetAddress } from '../core/addresses.ts';
import type { ServerStatus } from '../core/controller.ts';
import type { CloseAction, Settings } from '../core/settings.ts';

interface State {
    settings: Settings;
    settingsError: string;
    folderError: string;
    status: ServerStatus;
    addresses: NetAddress[];
    log: string[];
}

interface Bridge {
    platform: string;
    getState(): Promise<State>;
    getAddresses(): Promise<NetAddress[]>;
    chooseFolder(): Promise<Settings>;
    setSettings(changes: Partial<Settings>): Promise<Settings>;
    start(): Promise<ServerStatus>;
    stop(): Promise<void>;
    on(channel: 'log', listener: (line: string) => void): void;
    on(channel: 'status', listener: (status: ServerStatus) => void): void;
    on(channel: 'settings', listener: (settings: Settings) => void): void;
    on(channel: 'settingsError', listener: (error: string) => void): void;
}

const nbn = (window as unknown as { nbn: Bridge }).nbn;
const LOG_LINES = 1000;

function element<T extends HTMLElement>(id: string): T {
    const found = document.getElementById(id);
    if (found === null) {
        throw new Error(`No element ${id}`);
    }
    return found as T;
}

const folderText = element<HTMLSpanElement>('folder');
const folderError = element<HTMLParagraphElement>('folderError');
const chooseButton = element<HTMLButtonElement>('choose');
const stateText = element<HTMLSpanElement>('state');
const toggleButton = element<HTMLButtonElement>('toggle');
const serverError = element<HTMLParagraphElement>('serverError');
const addressList = element<HTMLUListElement>('addresses');
const portShown = element<HTMLSpanElement>('portShown');
const runningNote = element<HTMLParagraphElement>('runningNote');
const portInput = element<HTMLInputElement>('port');
const portError = element<HTMLParagraphElement>('portError');
const showDotsInput = element<HTMLInputElement>('showDots');
const trayLabel = element<HTMLSpanElement>('trayLabel');
const settingsError = element<HTMLParagraphElement>('settingsError');
const logView = element<HTMLPreElement>('log');
const closeInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="closeAction"]'));

let settings: Settings | undefined;
let status: ServerStatus = { running: false };
let busy = false;

function showError(target: HTMLElement, text: string): void {
    target.textContent = text;
    target.hidden = text === '';
}

function showSettings(): void {
    if (settings === undefined) {
        return;
    }
    folderText.textContent = settings.folder === '' ? 'No folder chosen' : settings.folder;
    if (document.activeElement !== portInput) {
        portInput.value = String(settings.port);
    }
    portShown.textContent = String(status.running && status.port !== undefined ? status.port : settings.port);
    showDotsInput.checked = settings.showDots;
    for (const input of closeInputs) {
        input.checked = input.value === settings.closeAction;
    }
    showControls();
}

function showControls(): void {
    if (settings === undefined) {
        return;
    }
    stateText.textContent = status.running ? 'Running' : 'Stopped';
    stateText.className = status.running ? 'state running' : 'state stopped';
    toggleButton.textContent = status.running ? 'Stop' : 'Start';
    toggleButton.disabled = busy || (!status.running && settings.folder === '');
    chooseButton.disabled = busy || status.running;
    portInput.disabled = busy || status.running;
    showDotsInput.disabled = busy || status.running;
    runningNote.hidden = !status.running;
    if (settings.folder === '' && !status.running) {
        showError(serverError, 'Choose a folder to share before you start the server.');
    } else {
        showError(serverError, status.error ?? '');
    }
}

function showAddresses(addresses: NetAddress[]): void {
    addressList.replaceChildren();
    if (addresses.length === 0) {
        const item = document.createElement('li');
        item.textContent = 'This computer is not connected to a network.';
        addressList.append(item);
        return;
    }
    for (const { name, address } of addresses) {
        const item = document.createElement('li');
        const label = document.createElement('span');
        label.className = 'interface';
        label.textContent = `  (${name})`;
        item.append(address, label);
        addressList.append(item);
    }
}

function addLog(lines: readonly string[]): void {
    const follow = logView.scrollTop + logView.clientHeight >= logView.scrollHeight - 4;
    for (const line of lines) {
        logView.append(line + '\n');
    }
    while (logView.childNodes.length > LOG_LINES) {
        logView.firstChild?.remove();
    }
    if (follow) {
        logView.scrollTop = logView.scrollHeight;
    }
}

async function run(action: () => Promise<unknown>): Promise<void> {
    busy = true;
    showControls();
    try {
        await action();
    } finally {
        busy = false;
        showControls();
    }
}

chooseButton.addEventListener('click', () => void run(async () => {
    settings = await nbn.chooseFolder();
    const state = await nbn.getState();
    showError(folderError, state.folderError);
    showSettings();
}));

toggleButton.addEventListener('click', () => void run(async () => {
    if (status.running) {
        await nbn.stop();
    } else {
        status = await nbn.start();
        showAddresses(await nbn.getAddresses());
    }
}));

portInput.addEventListener('change', () => void (async () => {
    const port = Number(portInput.value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        showError(portError, 'The port must be a number from 1 to 65535.');
        return;
    }
    showError(portError, '');
    settings = await nbn.setSettings({ port });
    showSettings();
})());

showDotsInput.addEventListener('change', () => void (async () => {
    settings = await nbn.setSettings({ showDots: showDotsInput.checked });
    showSettings();
})());

for (const input of closeInputs) {
    input.addEventListener('change', () => void (async () => {
        if (input.checked) {
            settings = await nbn.setSettings({ closeAction: input.value as CloseAction });
            showSettings();
        }
    })());
}

window.addEventListener('focus', () => void nbn.getAddresses().then(showAddresses));

nbn.on('log', (line) => addLog([line]));
nbn.on('status', (next) => {
    status = next;
    showSettings();
});
nbn.on('settings', (next) => {
    settings = next;
    showSettings();
});
nbn.on('settingsError', (error) => showError(settingsError, error));

trayLabel.textContent = nbn.platform === 'darwin'
    ? 'Keep the server running, with an icon in the menu bar'
    : 'Keep the server running, with an icon in the tray';

void nbn.getState().then((state) => {
    settings = state.settings;
    status = state.status;
    showError(folderError, state.folderError);
    showError(settingsError, state.settingsError);
    showAddresses(state.addresses);
    addLog(state.log);
    showSettings();
});
