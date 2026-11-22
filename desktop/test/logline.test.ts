import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatLogLine } from '../src/core/logline.ts';

test('a pino line becomes time, level and message', () => {
    const time = new Date(2026, 10, 22, 9, 5, 7).getTime();
    assert.equal(formatLogLine(JSON.stringify({ level: 30, time, pid: 1, hostname: 'h', msg: 'Client connected' })),
        '09:05:07 INFO  Client connected');
    assert.equal(formatLogLine(JSON.stringify({ level: 40, time, msg: 'Refused' })), '09:05:07 WARN  Refused');
    assert.equal(formatLogLine(JSON.stringify({ level: 50, time, msg: 'Error: x\n    at y' })), '09:05:07 ERROR Error: x\n    at y');
    assert.equal(formatLogLine(JSON.stringify({ level: 35, time, msg: 'odd' })), '09:05:07 35    odd');
});

test('other lines come back unchanged', () => {
    for (const line of ['not json', '42', 'null', '{"msg":"no level"}', '{"level":30,"time":1}']) {
        assert.equal(formatLogLine(line), line);
    }
});
