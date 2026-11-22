import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { before, test } from 'node:test';
import { getDir, quiet, readDirHeader, setup, type Client } from './helpers.ts';

before(quiet);

async function cd(client: Client, dir: string): Promise<string> {
    client.command(`CD ${dir}`);
    const answer = await client.readText(3);
    if (answer !== '!\r\n') {
        return answer;
    }
    return (await readDirHeader(client)).path;
}

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);

void test('DIR lists the files and folders, with sizes and types', async (t) => {
    const { client } = await setup(t, { 'a.txt': 'hello', 'sub/': '' });
    const { header, entries } = await getDir(client);
    assert.equal(header.version, 2);
    assert.equal(header.path, '/');
    assert.equal(header.totalEntries, 2);
    assert.equal(header.page, 1);
    assert.equal(header.pageSize, 2);
    assert.equal(header.totalPages, 1);
    assert.deepEqual(entries.sort(byName).map(({ name, type }) => ({ name, type })), [
        { name: 'a.txt', type: 1 },
        { name: 'sub', type: 0 },
    ]);
    assert.equal(entries.find((entry) => entry.name === 'a.txt')?.size, 5);
});

void test('DIR hides dot files', async (t) => {
    const { client } = await setup(t, { '.hidden': 'x', 'shown': 'x' });
    const { entries } = await getDir(client);
    assert.deepEqual(entries.map((entry) => entry.name), ['shown']);
});

void test('DIR shows dot files when SHOWDOTS is on', async (t) => {
    const { client } = await setup(t, { '.hidden': 'x', 'shown': 'x' }, { showDots: true });
    const { entries } = await getDir(client);
    assert.deepEqual(entries.sort(byName).map((entry) => entry.name), ['.hidden', 'shown']);
});

void test('DIR in a sub folder starts with ".."', async (t) => {
    const { client } = await setup(t, { 'sub/a.txt': 'x' });
    assert.equal(await cd(client, 'sub'), '/sub/');
    const { header, entries } = await getDir(client);
    assert.equal(header.path, '/sub/');
    assert.deepEqual(entries.map((entry) => entry.name), ['..', 'a.txt']);
});

void test('DIR splits a long folder into pages of 16', async (t) => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 20; i++) {
        files[`f${String(i).padStart(2, '0')}`] = 'x';
    }
    const { client } = await setup(t, files);
    const first = await getDir(client, 1);
    assert.equal(first.header.totalEntries, 20);
    assert.equal(first.header.totalPages, 2);
    assert.equal(first.entries.length, 16);
    const second = await getDir(client, 2);
    assert.equal(second.header.page, 2);
    assert.equal(second.entries.length, 4);
    const all = [...first.entries, ...second.entries].map((entry) => entry.name).sort();
    assert.deepEqual(all, Object.keys(files).sort());
});

void test('DIR of a current folder that was removed ends the session with BadFile_ERROR', async (t) => {
    const { client, root } = await setup(t, { 'sub/': '' });
    assert.equal(await cd(client, 'sub'), '/sub/');
    fs.rmdirSync(path.join(root, 'sub'));
    client.command('DIR');
    assert.equal(await client.readToClose(), 'BadFile_ERROR\r\n');
});

void test('CD into a folder answers "!" and the folder header', async (t) => {
    const { client } = await setup(t, { 'sub/deep/': '' });
    assert.equal(await cd(client, 'sub'), '/sub/');
    assert.equal(await cd(client, 'deep'), '/sub/deep/');
});

void test('CD with a name that starts with "/" is from the top', async (t) => {
    const { client } = await setup(t, { 'sub/deep/': '', 'other/': '' });
    assert.equal(await cd(client, 'sub/deep'), '/sub/deep/');
    assert.equal(await cd(client, '/other'), '/other/');
});

void test('CD .. goes up one folder', async (t) => {
    const { client } = await setup(t, { 'sub/deep/': '' });
    assert.equal(await cd(client, 'sub/deep'), '/sub/deep/');
    assert.equal(await cd(client, '..'), '/sub/');
});

void test('CD to a missing folder answers "<"', async (t) => {
    const { client } = await setup(t);
    assert.equal(await cd(client, 'nope'), '<\r\n');
});

void test('CD to a file answers "<"', async (t) => {
    const { client } = await setup(t, { 'a.txt': 'x' });
    assert.equal(await cd(client, 'a.txt'), '<\r\n');
});

void test('CD outside the public folder answers "<"', async (t) => {
    const { client } = await setup(t);
    assert.equal(await cd(client, '..'), '<\r\n');
});
