import axios from 'axios';
import { URL } from 'node:url';

const MAX_SIZE = 64 * 1024 * 1024;

async function react(conn, m, emoji) {
  try {
    await conn.sendMessage(m.chat, {
      react: {
        text: emoji,
        key: m.key
      }
    });
  } catch (e) {
    console.error('[GET] Error al reaccionar:', e.message);
  }
}

function getFileName(url, contentType) {
  try {
    const pathname = new URL(url).pathname;
    const name = decodeURIComponent(pathname.split('/').pop() || '');

    if (name && name.includes('.')) return name;

    const types = {
      'image/jpeg': 'imagen.jpg',
      'image/png': 'imagen.png',
      'image/webp': 'imagen.webp',
      'image/gif': 'imagen.gif',
      'video/mp4': 'video.mp4',
      'video/webm': 'video.webm',
      'audio/mpeg': 'audio.mp3',
      'audio/ogg': 'audio.ogg',
      'application/pdf': 'documento.pdf',
      'application/zip': 'archivo.zip'
    };

    return types[contentType?.split(';')[0].trim()] || 'archivo.bin';
  } catch {
    return 'archivo.bin';
  }
}

function getMediaType(contentType, fileName) {
  const mime = contentType?.split(';')[0].trim().toLowerCase() || '';

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';

  return 'document';
}

export default {
  command: ['get'],

  async execute(m, { conn, args, text }) {
    await react(conn, m, '🕗');

    try {
      const input = (text || args?.join(' ') || '')
        .trim()
        .replace(/^#?get\s+/i, '')
        .trim();

      if (!input) {
        await react(conn, m, '❌');
        return;
      }

      let parsed;

      try {
        parsed = new URL(input);
      } catch {
        await react(conn, m, '❌');
        return;
      }

      if (!['http:', 'https:'].includes(parsed.protocol) ||
          parsed.username || parsed.password) {
        await react(conn, m, '❌');
        return;
      }

      const response = await axios.get(parsed.href, {
        responseType: 'arraybuffer',
        timeout: 60000,
        maxRedirects: 5,
        maxContentLength: MAX_SIZE,
        maxBodyLength: MAX_SIZE,
        validateStatus: status => status >= 200 && status < 300,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
          Accept: '*/*'
        }
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || '';

      if (!buffer.length || buffer.length > MAX_SIZE ||
          /text\/html/i.test(contentType)) {
        await react(conn, m, '❌');
        return;
      }

      const fileName = getFileName(parsed.href, contentType);
      const type = getMediaType(contentType, fileName);
      const mime = contentType.split(';')[0] || 'application/octet-stream';

      if (type === 'image') {
        await conn.sendMessage(m.chat, {
          image: buffer,
          caption: `${fileName}`
        }, { quoted: m });
      } else if (type === 'video') {
        await conn.sendMessage(m.chat, {
          video: buffer,
          caption: `${fileName}`,
          mimetype: mime
        }, { quoted: m });
      } else if (type === 'audio') {
        await conn.sendMessage(m.chat, {
          audio: buffer,
          mimetype: mime,
          fileName
        }, { quoted: m });
      } else {
        await conn.sendMessage(m.chat, {
          document: buffer,
          mimetype: mime,
          fileName,
          caption: 'Archivo descargado'
        }, { quoted: m });
      }

      await react(conn, m, '✅');
    } catch (error) {
      console.error('[GET]', error?.message || error);
      await react(conn, m, '❌');
    }
  }
};
