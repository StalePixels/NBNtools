import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { test, type TestContext } from 'node:test';
import { addLogListener } from 'nbn-server';
import { formatLogLine } from '../src/core/logline.ts';
import { ServerController } from '../src/core/controller.ts';

const IP = '127.0.0.1';

function tempDir(t: TestContext): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nbn-desktop-')));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}

// A port that was free a moment ago.
async function freePort(): Promise<number> {
    const probe = net.createServer();
    await new Promise<void>((resolve) => probe.listen(0, IP, resolve));
    const address = probe.address() as net.AddressInfo;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    return address.port;
}

function connect(port: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
        const socket = net.connect(port, IP);
        socket.once('connect', () => resolve(socket));
        socket.once('error', reject);
    });
}

function closed(socket: net.Socket): Promise<void> {
    return new Promise((resolve) => {
        if (socket.destroyed) {
            resolve();
        } else {
            socket.once('close', () => resolve());
        }
    });
}

function controllerFor(t: TestContext): ServerController {
    const controller = new ServerController();
    t.after(() => controller.stop());
    return controller;
}

test('starts, takes connections, logs, and stops', async (t) => {
    const folder = tempDir(t);
    const port = await freePort();
    const lines: string[] = [];
    t.after(addLogListener((line) => lines.push(formatLogLine(line))));
    const controller = controllerFor(t);
    const changes: boolean[] = [];
    controller.on('status', (status: { running: boolean }) => changes.push(status.running));

    const status = await controller.start({ folder, port, showDots: false, ip: IP });
    assert.deepEqual(status, { running: true, port });
    assert.ok(lines.some((line) => line.includes(`listening on ${IP}:${port}`) && line.includes(folder)));

    const socket = await connect(port);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(lines.some((line) => / INFO  Client connected$/.test(line)));

    await controller.stop();
    await closed(socket);
    assert.deepEqual(controller.status, { running: false });
    assert.deepEqual(changes, [true, false]);
    await assert.rejects(connect(port));
});

test('a second start while running changes nothing', async (t) => {
    const folder = tempDir(t);
    const port = await freePort();
    const controller = controllerFor(t);
    await controller.start({ folder, port, showDots: false, ip: IP });
    assert.deepEqual(await controller.start({ folder, port: port + 1, showDots: false, ip: IP }), { running: true, port });
});

test('a port in use gives an error, and the server does not start', async (t) => {
    const folder = tempDir(t);
    const other = net.createServer();
    await new Promise<void>((resolve) => other.listen(0, IP, resolve));
    t.after(() => other.close());
    const port = (other.address() as net.AddressInfo).port;

    const controller = controllerFor(t);
    const status = await controller.start({ folder, port, showDots: false, ip: IP });
    assert.equal(status.running, false);
    assert.match(status.error ?? '', new RegExp(`Port ${port} is in use`));

    // The controller can start again once the port is free.
    await new Promise<void>((resolve) => other.close(() => resolve()));
    assert.equal((await controller.start({ folder, port, showDots: false, ip: IP })).running, true);
});

test('a missing folder gives an error, and the server does not start', async (t) => {
    const folder = path.join(tempDir(t), 'gone');
    const controller = controllerFor(t);
    const status = await controller.start({ folder, port: await freePort(), showDots: false, ip: IP });
    assert.equal(status.running, false);
    assert.match(status.error ?? '', /no longer exists/);
});

test('no folder gives an error, and the server does not start', async (t) => {
    const controller = controllerFor(t);
    const status = await controller.start({ folder: '', port: await freePort(), showDots: false, ip: IP });
    assert.deepEqual(status, { running: false, error: 'Choose a folder to share.' });
});

test('a file in place of the folder gives an error', async (t) => {
    const file = path.join(tempDir(t), 'file');
    fs.writeFileSync(file, 'x');
    const controller = controllerFor(t);
    const status = await controller.start({ folder: file, port: await freePort(), showDots: false, ip: IP });
    assert.equal(status.running, false);
    assert.match(status.error ?? '', /is not a folder/);
});

test('a bad port gives an error', async (t) => {
    const controller = controllerFor(t);
    const status = await controller.start({ folder: tempDir(t), port: 0, showDots: false, ip: IP });
    assert.equal(status.running, false);
    assert.match(status.error ?? '', /from 1 to 65535/);
});
