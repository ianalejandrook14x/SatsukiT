
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

async function streamToBuffer(stream) {
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function getQuotedVideo(m) {
  const quoted = m.quoted;

  // Formato de los wrappers utilizados por algunos bots
  if (quoted) {
    const type = quoted.mtype || quoted.type || '';
    const content =
      quoted.msg ||
      quoted.message?.videoMessage ||
      quoted.message ||
      {};

    if (/video/i.test(type) || content.videoMessage) {
      return {
        quoted,
        video: content.videoMessage || content
      };
    }
  }

  // Formato del mensaje original de WhatsApp
  const context =
    m.message?.extendedTextMessage?.contextInfo ||
    m.message?.imageMessage?.contextInfo ||
    m.message?.videoMessage?.contextInfo;

  const message = context?.quotedMessage;
  const video = message?.videoMessage;

  if (video) {
    return { quoted: null, video };
  }

  return null;
}

export default {
  command: ['estado', 'status', 'estadowa'],

  async handler(m, { conn }) {
    const log = (...args) =>
      console.log('[ESTADO]', ...args);

    try {
      log('Handler ejecutado');

      const found = getQuotedVideo(m);

      if (!found) {
        return await m.reply(
          '📹 Responde directamente a un video con el comando estado.'
        );
      }

      await m.reply('⏳ Preparando el video...');

      let media;

      // Método preferido del wrapper del bot
      if (found.quoted &&
          typeof found.quoted.download === 'function') {
        media = await found.quoted.download();
      } else {
        // Alternativa con la API oficial de Baileys
        const stream = await downloadContentFromMessage(
          found.video,
          'video'
        );

        media = await streamToBuffer(stream);
      }

      if (!Buffer.isBuffer(media)) {
        media = Buffer.from(media || []);
      }

      if (!media.length) {
        throw new Error('La descarga devolvió un archivo vacío');
      }

      log('Video descargado:', media.length, 'bytes');

      // Buscar contactos disponibles en la conexión
      const contacts =
        conn.store?.contacts ||
        conn.contacts ||
        {};

      const recipients = [
        ...new Set(
          Object.entries(contacts).flatMap(([jid, contact]) => {
            const id = contact?.id || contact?.jid || jid;

            return typeof id === 'string' &&
              id.endsWith('@s.whatsapp.net')
              ? [id]
              : [];
          })
        )
      ];

      if (!recipients.length) {
        throw new Error(
          'No hay contactos disponibles para statusJidList. ' +
          'Hay que adaptar esta parte al almacenamiento de tu bot.'
        );
      }

      await m.reply(
        `📤 Publicando video (${(media.length / 1048576).toFixed(2)} MB)...`
      );

      const result = await conn.sendMessage(
        'status@broadcast',
        {
          video: media,
          mimetype: found.video.mimetype || 'video/mp4'
        },
        {
          statusJidList: recipients,
          broadcast: true,
          mediaUploadTimeoutMs: 120000
        }
      );

      log('Resultado de sendMessage:', result?.key || result);

      return await m.reply(
        '✅ WhatsApp aceptó la solicitud de envío del estado.\n' +
        'Comprueba que el video aparezca en la pestaña Estados.'
      );

    } catch (error) {
      console.error('[ESTADO] Error completo:', error);

      return await m.reply(
        '❌ Error al publicar el estado:\n' +
        String(error?.message || error).slice(0, 500)
      );
    }
  }
};
