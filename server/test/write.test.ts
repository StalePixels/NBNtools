import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { before, test } from 'node:test';
import { Server } from '../build/index.js';
import { BLOCK_SIZE, checksum, getFile, putFile, quiet, readDirHeader, setup } from './helpers.ts';

before(quiet);

void test('MKDIR makes a folder and the folders above it', async (t) => {
    const { client, root } = await setup(t);
    client.command('MKDIR sub/deep');
    assert.equal(await client.readText(3), '!\r\n');
    assert.ok(fs.statSync(path.join(root, 'sub/deep')).isDirectory());
});

void test('MKDIR of a folder that exists answers "!"', async (t) => {
    const { client } = await setup(t, { 'sub/': '' });
    client.command('MKDIR sub');
    assert.equal(await client.readText(3), '!\r\n');
});

void test('MKDIR works from the current folder, and from the top with "/"', async (t) => {
    const { client, root } = await setup(t, { 'sub/': '' });
    client.command('CD sub');
    assert.equal(await client.readText(3), '!\r\n');
    await readDirHeader(client);
    client.command('MKDIR here');
    assert.equal(await client.readText(3), '!\r\n');
    client.command('MKDIR /top');
    assert.equal(await client.readText(3), '!\r\n');
    assert.ok(fs.statSync(path.join(root, 'sub/here')).isDirectory());
    assert.ok(fs.statSync(path.join(root, 'top')).isDirectory());
});

void test('MKDIR where a file is answers "<"', async (t) => {
    const { client } = await setup(t, { 'a.txt': 'x' });
    client.command('MKDIR a.txt');
    assert.equal(await client.readText(3), '<\r\n');
});

void test('MKDIR outside the public folder answers "<"', async (t) => {
    const { client, root } = await setup(t);
    client.command('MKDIR ../outside');
    assert.equal(await client.readText(3), '<\r\n');
    assert.ok(!fs.existsSync(path.join(root, '../outside')));
});

void test('MKDIR with no name answers BadCommand_ERROR and keeps the session', async (t) => {
    const { client } = await setup(t);
    client.command('MKDIR');
    assert.equal(await client.readText(18), 'BadCommand_ERROR\r\n');
    assert.ok(!client.isClosed());
});

void test('PUT writes the file', async (t) => {
    const data = randomBytes(10000);
    const { client, root } = await setup(t);
    assert.equal(await putFile(client, 'a.bin', data), 'ok');
    assert.deepEqual(fs.readFileSync(path.join(root, 'a.bin')), data);
});

void test('PUT of a whole number of blocks, and of an empty file', async (t) => {
    const data = randomBytes(2 * BLOCK_SIZE);
    const { client, root } = await setup(t);
    assert.equal(await putFile(client, 'two.bin', data), 'ok');
    assert.equal(await putFile(client, 'empty.bin', new Uint8Array()), 'ok');
    assert.deepEqual(fs.readFileSync(path.join(root, 'two.bin')), data);
    assert.equal(fs.statSync(path.join(root, 'empty.bin')).size, 0);
});

void test('PUT keeps a CR at the start of the file', async (t) => {
    const { client, root } = await setup(t);
    assert.equal(await putFile(client, 'cr.txt', Buffer.from('\r\nline')), 'ok');
    assert.equal(fs.readFileSync(path.join(root, 'cr.txt'), 'latin1'), '\r\nline');
});

void test('PUT works with a line that ends LF only', async (t) => {
    const { client, root } = await setup(t);
    client.write('PUT 2 a.txt\n');
    assert.equal(await client.readText(3), '!\r\n');
    client.write(Buffer.concat([Buffer.from('hi'), Uint8Array.from([checksum(Buffer.from('hi'))])]));
    assert.equal(await client.readText(3), '!\r\n');
    assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'latin1'), 'hi');
});

void test('PUT overwrites a file that exists', async (t) => {
    const { client, root } = await setup(t, { 'a.txt': 'a much longer old file' });
    assert.equal(await putFile(client, 'a.txt', Buffer.from('new')), 'ok');
    assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'latin1'), 'new');
});

void test('PUT of a name with spaces, in a sub folder', async (t) => {
    const { client, root } = await setup(t, { 'sub/': '' });
    assert.equal(await putFile(client, 'sub/a b.txt', Buffer.from('x')), 'ok');
    assert.equal(fs.readFileSync(path.join(root, 'sub/a b.txt'), 'latin1'), 'x');
});

void test('a file sent with PUT comes back the same with GET', async (t) => {
    const data = randomBytes(9000);
    const { client } = await setup(t);
    assert.equal(await putFile(client, 'a.bin', data), 'ok');
    assert.deepEqual(await getFile(client, 'a.bin'), data);
});

void test('PUT into a missing folder answers "<"', async (t) => {
    const { client } = await setup(t);
    assert.equal(await putFile(client, 'nope/a.txt', Buffer.from('x')), '<\r\n');
});

void test('PUT onto a folder answers "<"', async (t) => {
    const { client } = await setup(t, { 'sub/': '' });
    assert.equal(await putFile(client, 'sub', Buffer.from('x')), '<\r\n');
});

void test('PUT outside the public folder answers "<"', async (t) => {
    const { client, root } = await setup(t);
    assert.equal(await putFile(client, '../outside.txt', Buffer.from('x')), '<\r\n');
    assert.ok(!fs.existsSync(path.join(root, '../outside.txt')));
});

void test('PUT over the largest size answers "<"', async (t) => {
    const { client } = await setup(t);
    client.write('PUT 4294967296 big.bin\r\n');
    assert.equal(await client.readText(3), '<\r\n');
});

void test('PUT with no size or no name answers BadCommand_ERROR and keeps the session', async (t) => {
    const { client } = await setup(t);
    client.write('PUT a.txt\r\n');
    assert.equal(await client.readText(18), 'BadCommand_ERROR\r\n');
    client.write('PUT 1\r\n');
    assert.equal(await client.readText(18), 'BadCommand_ERROR\r\n');
    assert.ok(!client.isClosed());
});

void test('a block with a bad checksum gets "<", and the client sends it again', async (t) => {
    const { client, root } = await setup(t);
    const data = Buffer.from('hello');
    client.write('PUT 5 a.txt\r\n');
    assert.equal(await client.readText(3), '!\r\n');
    client.write(Buffer.concat([data, Uint8Array.from([(checksum(data) + 1) % 256])]));
    assert.equal(await client.readText(3), '<\r\n');
    client.write(Buffer.concat([data, Uint8Array.from([checksum(data)])]));
    assert.equal(await client.readText(3), '!\r\n');
    assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'latin1'), 'hello');
});

void test('a fourth bad checksum for one block ends the session with ExcessRetries_ERROR', async (t) => {
    const { client } = await setup(t);
    const bad = Buffer.concat([Buffer.from('hello'), Uint8Array.from([0])]);
    client.write('PUT 5 a.txt\r\n');
    assert.equal(await client.readText(3), '!\r\n');
    for (let i = 0; i < 3; i++) {
        client.write(bad);
        assert.equal(await client.readText(3), '<\r\n');
    }
    client.write(bad);
    assert.equal(await client.readToClose(), 'ExcessRetries_ERROR\r\n');
});

void test('the session takes commands again after a PUT', async (t) => {
    const { client } = await setup(t);
    assert.equal(await putFile(client, 'a.txt', Buffer.from('x')), 'ok');
    client.command('CD nope');
    assert.equal(await client.readText(3), '<\r\n');
});

void test('the base Server is read-only: PUT answers BadCommand_ERROR', async (t) => {
    const { client, root } = await setup(t, {}, { serverClass: Server });
    client.write('PUT 1 a.txt\r\n');
    assert.equal(await client.readText(18), 'BadCommand_ERROR\r\n');
    assert.ok(!fs.existsSync(path.join(root, 'a.txt')));
});

void test('the base Server is read-only: MKDIR answers BadCommand_ERROR', async (t) => {
    const { client, root } = await setup(t, {}, { serverClass: Server });
    client.command('MKDIR sub');
    assert.equal(await client.readText(18), 'BadCommand_ERROR\r\n');
    assert.ok(!fs.existsSync(path.join(root, 'sub')));
});
