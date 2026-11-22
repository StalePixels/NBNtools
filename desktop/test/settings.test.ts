import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { cleanSettings, defaultSettings, loadSettings, saveSettings } from '../src/core/settings.ts';

function tempDir(t: { after(fn: () => void): void }): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nbn-desktop-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}

test('no settings file gives the defaults', (t) => {
    assert.deepEqual(loadSettings(tempDir(t)), defaultSettings);
    assert.equal(defaultSettings.port, 48128);
    assert.equal(defaultSettings.folder, '');
});

test('saved settings load again', (t) => {
    const dir = path.join(tempDir(t), 'missing', 'folders');
    const settings = { folder: '/some/folder', port: 1234, showDots: true, closeAction: 'tray' as const };
    saveSettings(dir, settings);
    assert.deepEqual(loadSettings(dir), settings);
});

test('a broken settings file gives the defaults', (t) => {
    const dir = tempDir(t);
    fs.writeFileSync(path.join(dir, 'settings.json'), '{ not json');
    assert.deepEqual(loadSettings(dir), defaultSettings);
});

test('settings with wrong values get the defaults for those values', () => {
    assert.deepEqual(cleanSettings({ folder: 7, port: 70000, showDots: 'yes', closeAction: 'hide', extra: 1 }), defaultSettings);
    assert.deepEqual(cleanSettings({ port: 0 }), defaultSettings);
    assert.deepEqual(cleanSettings({ port: 12.5 }), defaultSettings);
    assert.deepEqual(cleanSettings(null), defaultSettings);
    assert.equal(cleanSettings({ port: 65535 }).port, 65535);
});
