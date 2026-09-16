import sharp from 'sharp'
import { prepareWAMessageMedia } from '@itsliaaa/baileys'
import { getSubbotConfig } from '../../lib/subbotconfig.js'

function getBotJid(conn) {
  return (
    conn.subBotJid ||
    conn.user?.jid ||
    conn.user?.id ||
    ''
  )
}

export default {
  command: ['stat', 'Stat', 'config'],
  noPrefix: true,

  async run(m, { conn }) {
    const botJid = getBotJid(conn)

    if (!botJid) {
      return m.reply(
        '*No se pudo identificar el Jadibot.*'
      )
    }

    const botConfig =
      getSubbotConfig(botJid)

    const botName =
      botConfig?.name ||
      'jᥲdιbot'

    const prefix =
      botConfig?.prefix ||
      'sιᥒ ρrᥱfιjo'

    const emoji =
      botConfig?.emoji ||
      '🍃'

    const selfMode =
      botConfig?.self === 'on'
        ? 'ρrιvᥲdo'
        : 'ρυbᥣιᥴo'

    const statText = `
ᴇꜱᴛᴀᴅɪꜱᴛɪᴄᴀꜱ ᴅᴇʟ ᴊᴀᴅɪʙᴏᴛ

ᥒombrᥱ: *${botName}*
ρrᥱfιjo: *${prefix}*
ᥱmojι: *${emoji}*
modo: *${selfMode}*`.trim()

    const previewUrl =
      'https://tewianix.org'

    const previewImage =
      botConfig?.mediaUrl ||
      'https://files.catbox.moe/rdn7sk.jpg'

    let linkPreview

    try {
      const imageResponse =
        await fetch(previewImage)

      if (!imageResponse.ok) {
        throw new Error(
          `Error HTTP ${imageResponse.status}`
        )
      }

      const originalBuffer =
        Buffer.from(
          await imageResponse.arrayBuffer()
        )

      const thumbnailBuffer =
        await sharp(originalBuffer)
          .resize(1280, 720, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({
            quality: 90
          })
          .toBuffer()

      const { imageMessage } =
        await prepareWAMessageMedia(
          {
            image: thumbnailBuffer
          },
          {
            upload:
              conn.waUploadToServer,
            mediaTypeOverride:
              'thumbnail-link'
          }
        )

      if (imageMessage) {
        imageMessage.width = 1280
        imageMessage.height = 720
      }

      linkPreview = {
        'canonical-url':
          previewUrl,

        'matched-text':
          previewUrl,

        title:
          botName,

        description:
          'bყ ιᥲᥒᥲᥣᥱjᥲᥒdrook16x',

        previewType: 0,

        jpegThumbnail:
          thumbnailBuffer,

        highQualityThumbnail:
          imageMessage,

        linkPreviewMetadata: {
          linkMediaDuration: 0,
          socialMediaPostType: 4
        }
      }
    } catch {
      linkPreview = null
    }

    if (linkPreview) {
      return await conn.sendMessage(
        m.chat,
        {
          text:
            `${previewUrl}\n\n${statText}`,

          linkPreview
        },
        {
          quoted: m
        }
      )
    }

    return m.reply(statText)
  }
}
