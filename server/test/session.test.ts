import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { quiet, setup } from './helpers.ts';

before(quiet);

void test('an unknown command answers BadCommand_ERROR and keeps the session', async (t) => {
    const { client } = await setup(t, { 'sub/': '' });
    client.command('FROB');
    assert.equal(await client.readText(18), 'BadCommand_ERROR\r\n');
    client.command('CD sub');
    assert.equal(await client.readText(3), '!\r\n');
});

void test('the third unknown command ends the session', async (t) => {
    const { client } = await setup(t);
    client.command('FROB');
    assert.equal(await client.readText(18), 'BadCommand_ERROR\r\n');
    client.command('FROB');
    assert.equal(await client.readText(18), 'BadCommand_ERROR\r\n');
    assert.ok(!client.isClosed());
    client.command('FROB');
    assert.equal(await client.readToClose(), 'BadCommand_ERROR\r\n');
    assert.ok(client.isClosed());
});

void test('a command with control characters ends the session at once', async (t) => {
    const { client } = await setup(t);
    client.write(Buffer.from([0x16, 0x03, 0x01, 0x00, 0x0a]));
    assert.equal(await client.readToClose(), 'BadCommand_ERROR\r\n');
    assert.ok(client.isClosed());
});

void test('a TAB inside a command is not a control character', async (t) => {
    const { client } = await setup(t);
    client.command('CD\tnope');
    assert.equal(await client.readText(18), 'BadCommand_ERROR\r\n');
    assert.ok(!client.isClosed());
});

void test('QUIT answers OK and ends the session', async (t) => {
    const { client } = await setup(t);
    client.command('QUIT');
    assert.equal(await client.readToClose(), 'OK\r\n');
    assert.ok(client.isClosed());
});

void test('a command in lower case works', async (t) => {
    const { client } = await setup(t, { 'sub/': '' });
    client.command('cd sub');
    assert.equal(await client.readText(3), '!\r\n');
});

void test('lines can end LF, CR LF or LF CR', async (t) => {
    const { client } = await setup(t);
    client.write('CD nope\n');
    assert.equal(await client.readText(3), '<\r\n');
    client.write('CD nope\r\n');
    assert.equal(await client.readText(3), '<\r\n');
    client.write('CD nope\n\r');
    assert.equal(await client.readText(3), '<\r\n');
});

void test('lines in one write are answered in order', async (t) => {
    const { client } = await setup(t, { 'sub/': '' });
    client.write('CD nope\n\rCD sub\n\r');
    assert.equal(await client.readText(3), '<\r\n');
    assert.equal(await client.readText(3), '!\r\n');
});

void test('a line split across writes is read as one line', async (t) => {
    const { client } = await setup(t, { 'sub/': '' });
    client.write('CD s');
    await new Promise((resolve) => setTimeout(resolve, 50));
    client.write('ub\n\r');
    assert.equal(await client.readText(3), '!\r\n');
});

void test('a line of 256 bytes is allowed', async (t) => {
    const { client } = await setup(t);
    client.write(`CD ${'x'.repeat(253)}\n`);
    assert.equal(await client.readText(3), '<\r\n');
});

void test('a line over 256 bytes ends the session with BadCommand_ERROR', async (t) => {
    const { client } = await setup(t);
    client.write(`CD ${'x'.repeat(254)}\n`);
    assert.equal(await client.readToClose(), 'BadCommand_ERROR\r\n');
});

void test('over 256 bytes with no LF ends the session with BadCommand_ERROR', async (t) => {
    const { client } = await setup(t);
    client.write('x'.repeat(257));
    assert.equal(await client.readToClose(), 'BadCommand_ERROR\r\n');
});

void test('16 waiting lines are allowed', async (t) => {
    const { client } = await setup(t);
    client.write('!\n'.repeat(16));
    await new Promise((resolve) => setTimeout(resolve, 50));
    client.command('QUIT');
    assert.equal(await client.readToClose(), 'OK\r\n');
});

void test('17 waiting lines end the session with BadCommand_ERROR', async (t) => {
    const { client } = await setup(t);
    client.write('!\n'.repeat(17));
    assert.equal(await client.readToClose(), 'BadCommand_ERROR\r\n');
});
