import * as assert from 'node:assert/strict';
import type * as os from 'node:os';
import { test } from 'node:test';
import { isPrivateIPv4, lanAddresses } from '../src/core/addresses.ts';

function info(address: string, family: 'IPv4' | 'IPv6', internal = false): os.NetworkInterfaceInfo {
    return { address, family, internal, netmask: '', mac: '', cidr: null } as os.NetworkInterfaceInfo;
}

test('only LAN IPv4 addresses are listed', () => {
    const result = lanAddresses({
        lo0: [info('127.0.0.1', 'IPv4', true), info('::1', 'IPv6', true)],
        en0: [info('fe80::1', 'IPv6'), info('192.168.1.20', 'IPv4')],
        en1: [info('169.254.3.4', 'IPv4')],
        en2: [info('10.0.0.5', 'IPv4')],
        utun1: [info('100.64.1.2', 'IPv4')],
        en3: [info('81.2.3.4', 'IPv4')],
        none: undefined,
    });
    assert.deepEqual(result, [
        { name: 'en0', address: '192.168.1.20' },
        { name: 'en2', address: '10.0.0.5' },
    ]);
});

test('private ranges', () => {
    for (const address of ['10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.1', '192.168.0.1']) {
        assert.equal(isPrivateIPv4(address), true, address);
    }
    for (const address of ['172.15.0.1', '172.32.0.1', '192.169.0.1', '169.254.1.1', '100.64.0.1', '127.0.0.1', '8.8.8.8']) {
        assert.equal(isPrivateIPv4(address), false, address);
    }
});

test('the real interfaces give a list without loopback', () => {
    for (const { address } of lanAddresses()) {
        assert.ok(!address.startsWith('127.'));
    }
});
