import * as assert from 'node:assert/strict';
import * as net from 'node:net';
import { once } from 'node:events';
import { test, type TestContext } from 'node:test';
import { PersonalServer, startServer, type Config } from '../build/index.js';
import { makeRoot, quiet, removeRoot } from './helpers.ts';

const IP = '127.0.0.1';

// A server of another program on a free port of 127.0.0.1.
async function busyPort(t: TestContext): Promise<{ other: net.Server; port: number }> {
    const other = net.createServer();
    await new Promise<void>((resolve) => other.listen(0, IP, resolve));
    t.after(() => new Promise<void>((resolve) => other.close(() => resolve())));
    const address = other.address();
    if (address === null || typeof address === 'string') {
        throw new Error('no port');
    }
    return { other, port: address.port };
}

// The error that `server` emits next.
function nextError(server: net.Server): Promise<NodeJS.ErrnoException> {
    return new Promise((resolve) => server.once('error', resolve));
}

function configFor(root: string, port: number, retry: number): Config {
    return {
        BACKLOG: 16,
        FILEPATH: root,
        IDLE: 600000,
        IP,
        MAXCONNS: 512,
        MAXPERIP: 16,
        PORT: port,
        RETRY: retry,
        SHOWDOTS: false,
    };
}

void test('RETRY 0: a busy port gives EADDRINUSE, and the server does not listen', async (t) => {
    quiet();
    const root = makeRoot();
    t.after(() => removeRoot(root));
    const { other, port } = await busyPort(t);

    const server = startServer(PersonalServer, configFor(root, port, 0));
    t.after(() => server.close());
    let listened = false;
    server.on('listening', () => {
        listened = true;
    });
    const err = await nextError(server);
    assert.equal(err.code, 'EADDRINUSE');

    // No retry: the server stays closed after the port is free again.
    await new Promise<void>((resolve) => other.close(() => resolve()));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(listened, false);
    assert.equal(server.listening, false);
});

void test('RETRY above 0: the server listens once the port is free', async (t) => {
    quiet();
    const root = makeRoot();
    t.after(() => removeRoot(root));
    const { other, port } = await busyPort(t);

    const server = startServer(PersonalServer, configFor(root, port, 20));
    t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
    await nextError(server);
    await new Promise<void>((resolve) => other.close(() => resolve()));
    await once(server, 'listening');
    assert.equal(server.listening, true);
});
