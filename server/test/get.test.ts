import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { before, test } from 'node:test';
import { BLOCK_SIZE, checksum, getFile, quiet, readDirHeader, readFileHeader, setup } from './helpers.ts';

before(quiet);

void test('GET sends the file header', async (t) => {
    const { client } = await setup(t, { 'a.bin': randomBytes(10000) });
    client.command('GET a.bin');
    assert.deepEqual(await readFileHeader(client), {
        version: 2,
        size: 10000,
        blocks: 2,
        remainder: 10000 - 2 * BLOCK_SIZE,
        name: 'a.bin',
    });
});

void test('GET sends the file in blocks', async (t) => {
    const data = randomBytes(10000);
    const { client } = await setup(t, { 'a.bin': data });
    assert.deepEqual(await getFile(client, 'a.bin'), data);
});

void test('GET of a whole number of blocks ends with an empty block', async (t) => {
    const data = randomBytes(2 * BLOCK_SIZE);
    const { client } = await setup(t, { 'a.bin': data });
    client.command('GET a.bin');
    const header = await readFileHeader(client);
    assert.equal(header.blocks, 2);
    assert.equal(header.remainder, 0);
    client.command('!');
    await client.read(BLOCK_SIZE + 1);
    client.command('!');
    await client.read(BLOCK_SIZE + 1);
    client.command('!');
    assert.deepEqual([...await client.read(1)], [0]);
});

void test('GET of an empty file', async (t) => {
    const { client } = await setup(t, { 'empty.txt': '' });
    assert.equal((await getFile(client, 'empty.txt')).length, 0);
});

void test('GET of a name with spaces', async (t) => {
    const { client } = await setup(t, { 'a b.txt': 'hello' });
    assert.equal((await getFile(client, 'a b.txt')).toString(), 'hello');
});

void test('GET of a name that is not ASCII', async (t) => {
    const { client } = await setup(t, { 'café.txt': 'x' });
    client.command('GET café.txt');
    const header = await readFileHeader(client);
    assert.equal(header.size, 1);
});

void test('GET reads from the current folder', async (t) => {
    const { client } = await setup(t, { 'sub/a.txt': 'in sub' });
    client.command('CD sub');
    assert.equal(await client.readText(3), '!\r\n');
    await readDirHeader(client);
    assert.equal((await getFile(client, 'a.txt')).toString(), 'in sub');
});

void test('the session takes commands again after a GET', async (t) => {
    const { client } = await setup(t, { 'a.txt': 'x' });
    await getFile(client, 'a.txt');
    client.command('CD nope');
    assert.equal(await client.readText(3), '<\r\n');
});

void test('"<" sends the same block again', async (t) => {
    const data = randomBytes(10000);
    const { client } = await setup(t, { 'a.bin': data });
    client.command('GET a.bin');
    await readFileHeader(client);
    client.command('!');
    const first = await client.read(BLOCK_SIZE + 1);
    client.command('<');
    assert.deepEqual(await client.read(BLOCK_SIZE + 1), first);
    assert.equal(first[BLOCK_SIZE], checksum(data.subarray(0, BLOCK_SIZE)));
});

void test('a fourth "<" for one block ends the session with ExcessRetries_ERROR', async (t) => {
    const { client } = await setup(t, { 'a.bin': randomBytes(10000) });
    client.command('GET a.bin');
    await readFileHeader(client);
    client.command('!');
    await client.read(BLOCK_SIZE + 1);
    for (let i = 0; i < 3; i++) {
        client.command('<');
        await client.read(BLOCK_SIZE + 1);
    }
    client.command('<');
    assert.equal(await client.readToClose(), 'ExcessRetries_ERROR\r\n');
});

void test('only the first "!1" from an old client counts', async (t) => {
    const data = randomBytes(10000);
    const { client } = await setup(t, { 'a.bin': data });
    client.command('GET a.bin');
    await readFileHeader(client);
    client.command('!1');
    const first = await client.read(BLOCK_SIZE + 1);
    client.command('!1');
    client.command('!');
    const second = await client.read(BLOCK_SIZE + 1);
    assert.deepEqual(first.subarray(0, BLOCK_SIZE), data.subarray(0, BLOCK_SIZE));
    assert.deepEqual(second.subarray(0, BLOCK_SIZE), data.subarray(BLOCK_SIZE, 2 * BLOCK_SIZE));
});

void test('GET of a missing file answers NoFile_ERROR and keeps the session', async (t) => {
    const { client } = await setup(t);
    client.command('GET nope.txt');
    assert.equal(await client.readText(14), 'NoFile_ERROR\r\n');
    client.command('CD nope');
    assert.equal(await client.readText(3), '<\r\n');
});

void test('GET of a folder answers NoFile_ERROR', async (t) => {
    const { client } = await setup(t, { 'sub/': '' });
    client.command('GET sub');
    assert.equal(await client.readText(14), 'NoFile_ERROR\r\n');
});

void test('GET outside the public folder answers BadPath_ERROR', async (t) => {
    const { client } = await setup(t);
    client.command('GET ../outside.txt');
    assert.equal(await client.readText(15), 'BadPath_ERROR\r\n');
});
