
export default {
  command: [
    'estado',
    'status',
    'estadowa'
  ],

  async handler(m, { conn }) {
    try {
      // Verificar que el comando responda a un mensaje
      const quoted = m.quoted;

      if (!quoted) {
        return m.reply(
          'Responde a un video con el comando'
        );
      }

      // Comprobar que el mensaje citado sea un video
      const type = quoted.mtype || '';

      if (
        type !== 'videoMessage' &&
        !type.toLowerCase().includes('video')
      ) {
        return m.reply(
          'El mensaje no es un video'
        );
      }

      await m.reply('[2] paso');

      // Descargar el contenido original disponible en el chat
      const media = await quoted.download();

      if (!media || !media.length) {
        return m.reply(
          'No se pudo descargar el video'
        );
      }

      // Publicar el video como estado de WhatsApp
      await conn.sendMessage(
        'status@broadcast',
        {
          video: media,
          mimetype: quoted.mimetype || 'video/mp4'
        },
        {
          statusJidList: Object.keys(conn.contacts || {})
            .filter(jid => jid.endsWith('@s.whatsapp.net'))
        }
      );

      return m.reply(
        'Video enviado.'
      );

    } catch (error) {
      console.error('Error en el plugin:', error);

      return m.reply(
        'No se pudo'
      );
    }
  }
};
