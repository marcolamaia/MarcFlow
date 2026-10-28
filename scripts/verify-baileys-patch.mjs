import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { downloadMediaMessage, prepareWAMessageMedia } from '@whiskeysockets/baileys';

const bytes = Buffer.from('%PDF-1.4\nMarcFlow offline media check\n%%EOF');
const document = { document: bytes, mimetype: 'application/pdf', fileName: 'check.pdf' };

test('channel documents upload raw bytes and keep channel media metadata', async () => {
    let uploaded = false;
    const result = await prepareWAMessageMedia(document, {
        jid: '123456789@newsletter',
        upload: async (filePath, options) => {
            assert.equal(options.newsletter, true);
            assert.deepEqual(await readFile(filePath), bytes);
            assert.equal(options.fileEncSha256B64, createHash('sha256').update(bytes).digest('base64'));
            uploaded = true;
            return { mediaUrl: 'https://example.invalid/file', directPath: '/o1/check.pdf' };
        },
    });
    assert.equal(uploaded, true);
    assert.equal(result.documentMessage.directPath, '/m1/check.pdf');
    assert.equal(result.documentMessage.fileName, 'check.pdf');
    assert.deepEqual(Buffer.from(result.documentMessage.fileSha256), createHash('sha256').update(bytes).digest());
    assert.equal(Object.hasOwn(result.documentMessage, 'mediaKey'), false);
    assert.equal(Object.hasOwn(result.documentMessage, 'fileEncSha256'), false);
});

test('normal WhatsApp documents remain encrypted before upload', async () => {
    const result = await prepareWAMessageMedia(document, {
        jid: '5511999999999@s.whatsapp.net',
        upload: async (filePath, options) => {
            assert.notEqual(options.newsletter, true);
            const encrypted = await readFile(filePath);
            assert.notDeepEqual(encrypted, bytes);
            assert.equal(options.fileEncSha256B64, createHash('sha256').update(encrypted).digest('base64'));
            return { mediaUrl: 'https://example.invalid/file', directPath: '/encrypted/check.pdf' };
        },
    });
    assert.equal(result.documentMessage.mediaKey.length, 32);
    assert.equal(result.documentMessage.fileEncSha256.length, 32);
    assert.equal(result.documentMessage.directPath, '/encrypted/check.pdf');
});

test('channel media download returns raw bytes without requiring an encryption key', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
        assert.equal(url, 'https://mmg.whatsapp.net/m1/check.pdf');
        assert.equal(options.headers.Origin, 'https://web.whatsapp.com');
        return new Response(bytes);
    };
    try {
        const result = await downloadMediaMessage({
            key: { remoteJid: '123456789@newsletter', id: 'offline-check' },
            message: { documentMessage: { directPath: '/m1/check.pdf', mimetype: 'application/pdf' } },
        }, 'buffer', {});
        assert.deepEqual(result, bytes);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('WhatsApp image thumbnails work with the updated native image library', async () => {
    const image = await sharp({
        create: { width: 64, height: 64, channels: 4, background: '#00a884' },
    }).png().toBuffer();
    const result = await prepareWAMessageMedia({ image, mimetype: 'image/png' }, {
        jid: '5511999999999@s.whatsapp.net',
        upload: async () => ({
            mediaUrl: 'https://example.invalid/image', directPath: '/encrypted/image.png',
        }),
    });
    assert.equal(result.imageMessage.width, 64);
    assert.equal(result.imageMessage.height, 64);
    assert.ok(result.imageMessage.jpegThumbnail.length > 0);
    assert.equal(result.imageMessage.mediaKey.length, 32);
});
