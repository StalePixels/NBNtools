import * as os from 'node:os';

export interface NetAddress {
    name: string;
    address: string;
}

// True for the private IPv4 ranges that home networks use: 10.x.x.x,
//    172.16.x.x to 172.31.x.x, and 192.168.x.x.
export function isPrivateIPv4(address: string): boolean {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || (a === 172 && b !== undefined && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// The IPv4 addresses in private ranges, which a Next on the same network can
//    use. IPv4 only, because the server listens on 0.0.0.0.
export function lanAddresses(
    interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces(),
): NetAddress[] {
    const result: NetAddress[] = [];
    for (const [name, infos] of Object.entries(interfaces)) {
        for (const info of infos ?? []) {
            if (info.family !== 'IPv4' || info.internal || !isPrivateIPv4(info.address)) {
                continue;
            }
            result.push({ name, address: info.address });
        }
    }
    return result;
}
