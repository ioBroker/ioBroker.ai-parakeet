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

/** `localhost`, `*.localhost` and the loopback addresses: browsers treat them as secure even over HTTP */
export function isLoopbackHost(hostname: string): boolean {
    const host = hostname
        .toLowerCase()
        .replace(/^\[(.*)\]$/, '$1')
        .replace(/\.$/, '');
    return (
        host === 'localhost' ||
        host.endsWith('.localhost') ||
        /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
        host === '::1' ||
        host === '0:0:0:0:0:0:0:1'
    );
}

/**
 * True if a browser opens the URL in a secure context. Only there it allows the microphone
 * (getUserMedia) and AudioWorklet: HTTPS, or HTTP on localhost.
 */
export function isSecureContextUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname));
    } catch {
        return false;
    }
}

/**
 * The host name from the address of admin in the browser, if the browser reaches admin directly:
 * with the port that admin listens on, so not through a reverse proxy or a mapped port.
 *
 * @param adminUrl the address of admin in the browser, e.g. `http://localhost:8081/`
 * @param adminPort the port in the settings of the admin instance
 * @returns the host name as it goes into a URL (IPv6 in brackets), undefined if it cannot be used
 */
export function directAdminHost(adminUrl: unknown, adminPort: unknown): string | undefined {
    if (typeof adminUrl !== 'string' || !adminUrl) {
        return undefined;
    }
    let url: URL;
    try {
        url = new URL(adminUrl);
    } catch {
        return undefined;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return undefined;
    }
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    return url.hostname && port === Number(adminPort) ? url.hostname : undefined;
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
