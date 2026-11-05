import assert from 'node:assert/strict';

import {
    addressRank,
    directAdminHost,
    isLoopbackHost,
    isSecureContextUrl,
    selectLanAddress,
} from '../../src/lib/network';

describe('network', () => {
    describe('isLoopbackHost', () => {
        it('accepts localhost and the loopback addresses', () => {
            for (const host of [
                'localhost',
                'LOCALHOST',
                'localhost.',
                'iobroker.localhost',
                '127.0.0.1',
                '127.1.2.3',
                '[::1]',
                '::1',
            ]) {
                assert.equal(isLoopbackHost(host), true, host);
            }
        });

        it('rejects other hosts', () => {
            for (const host of ['192.168.1.5', 'iobroker', 'localhost.example.com', '128.0.0.1', '[::2]', '']) {
                assert.equal(isLoopbackHost(host), false, host);
            }
        });
    });

    describe('isSecureContextUrl', () => {
        it('is true for HTTPS and for HTTP on localhost', () => {
            assert.equal(isSecureContextUrl('https://192.168.1.5:9999/'), true);
            assert.equal(isSecureContextUrl('http://localhost:9999/'), true);
            assert.equal(isSecureContextUrl('http://127.0.0.1:9999/'), true);
            assert.equal(isSecureContextUrl('http://[::1]:9999/'), true);
        });

        it('is false for HTTP on other hosts and for invalid addresses', () => {
            assert.equal(isSecureContextUrl('http://192.168.1.5:9999/'), false);
            assert.equal(isSecureContextUrl('http://iobroker:9999/'), false);
            assert.equal(isSecureContextUrl('ftp://localhost/'), false);
            assert.equal(isSecureContextUrl('${_href}'), false);
        });
    });

    describe('directAdminHost', () => {
        it('returns the host if admin is reached on its own port', () => {
            assert.equal(directAdminHost('http://localhost:8081/', 8081), 'localhost');
            assert.equal(
                directAdminHost('https://iobroker.fritz.box:8081/#tab-instances', '8081'),
                'iobroker.fritz.box',
            );
            assert.equal(directAdminHost('http://[::1]:8081/', 8081), '[::1]');
            assert.equal(directAdminHost('https://iobroker/', 443), 'iobroker');
        });

        it('returns undefined behind a reverse proxy or a mapped port', () => {
            assert.equal(directAdminHost('https://home.example.com/admin/', 8081), undefined);
            assert.equal(directAdminHost('http://localhost:18081/', 8081), undefined);
        });

        it('returns undefined without a usable address', () => {
            // older admin versions send the pattern as it is
            assert.equal(directAdminHost('${_href}', 8081), undefined);
            assert.equal(directAdminHost(undefined, 8081), undefined);
            assert.equal(directAdminHost('', 8081), undefined);
            assert.equal(directAdminHost('file:///index.html', 8081), undefined);
            assert.equal(directAdminHost('http://localhost:8081/', undefined), undefined);
        });
    });

    describe('selectLanAddress', () => {
        it('prefers home networks over bridges', () => {
            const info = (address: string): any => ({ address, family: 'IPv4', internal: false });
            assert.equal(
                selectLanAddress({ docker: [info('172.17.0.1')], eth0: [info('192.168.1.5')] }),
                '192.168.1.5',
            );
            assert.equal(addressRank('10.0.0.2'), 1);
        });
    });
});
