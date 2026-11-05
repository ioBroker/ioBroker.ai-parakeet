import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';

/**
 * Rank of an IPv4 address as address of the server for clients, lower is better:
 * home and company networks first, then public addresses, then the ranges of
 * Docker/Hyper-V/WSL bridges (172.16.0.0/12), VPNs like Tailscale (100.64.0.0/10) and link-local addresses.
 */
export function addressRank(address: string): number {
    const [a, b] = address.split('.').map(Number);
    if (a === 192 && b === 168) {
        return 0;
    }
    if (a === 10) {
        return 1;
    }
    if (a === 172 && b >= 16 && b <= 31) {
        return 3;
    }
    if (a === 100 && b >= 64 && b <= 127) {
        return 4;
    }
    if (a === 169 && b === 254) {
        return 5;
    }
    return 2;
}

/** The IPv4 address of this host under which clients in the network most likely reach it */
export function selectLanAddress(
    interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): string | undefined {
    const addresses = Object.values(interfaces)
        .flatMap(list => list ?? [])
        .filter(info => info.family === 'IPv4' && !info.internal)
        .map(info => info.address);
    // the sort is stable: addresses with the same rank keep the order of the interfaces
    return addresses.sort((a, b) => addressRank(a) - addressRank(b))[0];
}
