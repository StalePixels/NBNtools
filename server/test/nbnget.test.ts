// Runs the POSIX build of the real nbnget client (clients/nbnget, `make posix`)
//    against a PersonalServer. Skipped when the client does not build.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { before, test, type TestContext } from 'node:test';
import { promisify } from 'node:util';
import { BLOCK_SIZE, makeRoot, quiet, removeRoot, startTestServer } from './helpers.ts';

const run = promisify(execFile);
const clientDir = path.resolve(import.meta.dirname, '../../clients/nbnget');
const nbnget = path.join(clientDir, 'BUILD-posix/nbnget');
let built = false;

before(async () => {
    quiet();
    try {
        await run('make', ['-C', clientDir, 'posix']);
        built = true;
    } catch {
        built = false;
    }
});

// nbnget writes into its current folder. $HOME/.nbn is its pretend SD card,
//    so HOME points into the test folder too.
async function fetch(t: TestContext, files: Record<string, Uint8Array>, name: string): Promise<{ code: number; out: string }> {
    const root = makeRoot();
    const work = makeRoot();
    for (const [file, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(root, file), content);
    }
    const server = await startTestServer(root);
    t.after(async () => {
        await server.close();
        removeRoot(root);
        removeRoot(work);
    });
    try {
        await run(nbnget, ['-s', '127.0.0.1', '-p', String(server.port), '-q', name], {
            cwd: work,
            env: { ...process.env, HOME: work },
            timeout: 15000,
        });
        return { code: 0, out: work };
    } catch (err) {
        const code = err instanceof Error && 'code' in err && typeof err.code === 'number' ? err.code : -1;
        return { code, out: work };
    }
}

void test('nbnget fetches a file', async (t) => {
    if (!built) {
        t.skip('nbnget did not build');
        return;
    }
    const data = randomBytes(10000);
    const { code, out } = await fetch(t, { 'a.bin': data }, 'a.bin');
    assert.equal(code, 0);
    assert.deepEqual(fs.readFileSync(path.join(out, 'a.bin')), data);
});

void test('nbnget fetches a file of a whole number of blocks', async (t) => {
    if (!built) {
        t.skip('nbnget did not build');
        return;
    }
    const data = randomBytes(3 * BLOCK_SIZE);
    const { code, out } = await fetch(t, { 'b.bin': data }, 'b.bin');
    assert.equal(code, 0);
    assert.deepEqual(fs.readFileSync(path.join(out, 'b.bin')), data);
});

void test('nbnget fails on a missing file', async (t) => {
    if (!built) {
        t.skip('nbnget did not build');
        return;
    }
    const { code, out } = await fetch(t, {}, 'nope.bin');
    assert.notEqual(code, 0);
    assert.ok(!fs.existsSync(path.join(out, 'nope.bin')));
});
