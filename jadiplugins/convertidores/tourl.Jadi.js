import sharp from 'sharp'
import {
    downloadContentFromMessage,
    prepareWAMessageMedia
} from '@itsliaaa/baileys'
import {
    getSubbotConfig
} from '../../lib/subbotconfig.js'
import config from '../../config.js'

function getBotJid(conn) {
    return (
        conn?.subBotJid ||
        conn?.user?.jid ||
        conn?.user?.id ||
        ''
    )
}

function getBotConfig(conn) {
    const botJid = getBotJid(conn)

    if (!botJid) {
        return {}
    }

    return getSubbotConfig(botJid)
}

function getPrefix(conn, botConfig, usedPrefix) {
    if (
        typeof botConfig?.prefix === 'string'
    ) {
        return botConfig.prefix
    }

    if (
        typeof usedPrefix === 'string'
    ) {
        return usedPrefix
    }

    if (
        Array.isArray(config?.prefixes) &&
        config.prefixes.length
    ) {
        return config.prefixes[0]
    }

    return ''
}

function getEmoji(botConfig) {
    return (
        typeof botConfig?.emoji === 'string' &&
        botConfig.emoji.trim()
            ? botConfig.emoji.trim()
            : '🍃'
    )
}

function getQuotedImage(m) {
    const quoted = m?.quoted

    if (!quoted) {
        return null
    }

    if (
        quoted?.message?.imageMessage
    ) {
        return quoted.message.imageMessage
    }

    if (
        quoted?.imageMessage
    ) {
        return quoted.imageMessage
    }

    if (
        quoted?.msg?.imageMessage
    ) {
        return quoted.msg.imageMessage
    }

    return null
}

async function downloadWhatsAppImage(
    imageMessage
) {
    const stream =
        await downloadContentFromMessage(
            imageMessage,
            'image'
        )

    const chunks = []

    for await (
        const chunk of stream
    ) {
        chunks.push(
            Buffer.from(chunk)
        )
    }

    const buffer =
        Buffer.concat(chunks)

    if (!buffer.length) {
        throw new Error(
            'La imagen de WhatsApp está vacía.'
        )
    }

    return {
        buffer,
        mimetype:
            imageMessage?.mimetype ||
            'image/jpeg'
    }
}

async function downloadImageFromUrl(url) {
    let parsedUrl

    try {
        parsedUrl = new URL(url)
    } catch {
        throw new Error(
            '*La URL proporcionada no es válida.*'
        )
    }

    if (
        parsedUrl.protocol !== 'http:' &&
        parsedUrl.protocol !== 'https:'
    ) {
        throw new Error(
            '*La URL debe utilizar HTTP o HTTPS*'
        )
    }

    const response =
        await fetch(
            parsedUrl.toString()
        )

    if (!response.ok) {
        throw new Error(
            `*No se pudo descargar la imagen. HTTP ${response.status}.*`
        )
    }

    const contentType =
        String(
            response.headers.get(
                'content-type'
            ) || ''
        )
            .toLowerCase()
            .split(';')[0]
            .trim()

    if (
        !contentType.startsWith('image/')
    ) {
        throw new Error(
            '*La URL proporcionada no contiene una imagen.*'
        )
    }

    const buffer =
        Buffer.from(
            await response.arrayBuffer()
        )

    if (!buffer.length) {
        throw new Error(
            'La imagen descargada está vacía.'
        )
    }

    return {
        buffer,
        mimetype: contentType
    }
}

async function uploadToCatbox(
    buffer,
    mimetype = 'image/jpeg'
) {
    const extension =
        mimetype.includes('png')
            ? 'png'
            : mimetype.includes('webp')
                ? 'webp'
                : mimetype.includes('gif')
                    ? 'gif'
                    : 'jpg'

    const form =
        new FormData()

    form.append(
        'reqtype',
        'fileupload'
    )

    form.append(
        'fileToUpload',
        new Blob(
            [
                buffer
            ],
            {
                type: mimetype
            }
        ),
        `image.${extension}`
    )

    const response =
        await fetch(
            'https://catbox.moe/user/api.php',
            {
                method: 'POST',
                body: form
            }
        )

    const result =
        String(
            await response.text()
        ).trim()

    if (!response.ok) {
        throw new Error(
            `Catbox HTTP ${response.status}: ${result}`
        )
    }

    if (
        !/^https?:\/\/files\.catbox\.moe\//i.test(
            result
        )
    ) {
        throw new Error(
            `Catbox devolvió una respuesta inválida: ${result}`
        )
    }

    return result
}

async function createLinkPreview(
    conn,
    imageUrl,
    title,
    description
) {
    try {
        const response =
            await fetch(imageUrl)

        if (!response.ok) {
            return null
        }

        const contentType =
            String(
                response.headers.get(
                    'content-type'
                ) || ''
            ).toLowerCase()

        if (
            !contentType.startsWith('image/')
        ) {
            return null
        }

        const originalBuffer =
            Buffer.from(
                await response.arrayBuffer()
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
                    image:
                        thumbnailBuffer
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

        return {
            'canonical-url':
                imageUrl,

            'matched-text':
                imageUrl,

            title,

            description,

            previewType:
                0,

            jpegThumbnail:
                thumbnailBuffer,

            highQualityThumbnail:
                imageMessage,

            linkPreviewMetadata: {
                linkMediaDuration:
                    0,

                socialMediaPostType:
                    4
            }
        }

    } catch {
        return null
    }
}

export default {
    command: [
        'tourl',
        'url'
    ],

    async run(
        m,
        {
            conn,
            args,
            usedPrefix
        }
    ) {

        const botConfig =
            getBotConfig(conn)

        const prefix =
            getPrefix(
                conn,
                botConfig,
                usedPrefix
            )

        const emoji =
            getEmoji(botConfig)

        const botImage =
            botConfig?.mediaUrl ||
            'https://files.catbox.moe/rdn7sk.jpg'

        const argumentos =
            Array.isArray(args)
                ? args
                : []

        const url =
            argumentos
                .join(' ')
                .trim()

        const quotedImage =
            getQuotedImage(m)

        if (
            !url &&
            !quotedImage
        ) {

            const usageText =
                `*υso ιncorrecтo del comando* ${emoji}
ᥣos modos dιsρoᥒιbᥣᥱs soᥒ:

${prefix}toυrᥣ [rᥱsρoᥒdᥱ ᥲ υᥒᥲ ιmᥲgᥱᥒ]
${prefix}toυrᥣ [υrᥣ]`

            const linkPreview =
                await createLinkPreview(
                    conn,
                    botImage,
                    'toυrᥣ',
                    `sυbιr ᥲrᥴhιvos ᥲ υrᥣ. ${emoji}`
                )

            if (linkPreview) {
                return conn.sendMessage(
                    m.chat,
                    {
                        text:
                            `${botImage}\n\n${usageText}`,

                        linkPreview
                    },
                    {
                        quoted: m
                    }
                )
            }

            return m.reply(
                usageText
            )
        }

        try {

            let imageBuffer
            let mimetype

            if (quotedImage) {

                const downloaded =
                    await downloadWhatsAppImage(
                        quotedImage
                    )

                imageBuffer =
                    downloaded.buffer

                mimetype =
                    downloaded.mimetype

            } else {

                const downloaded =
                    await downloadImageFromUrl(
                        url
                    )

                imageBuffer =
                    downloaded.buffer

                mimetype =
                    downloaded.mimetype
            }

            const catboxUrl =
                await uploadToCatbox(
                    imageBuffer,
                    mimetype
                )

            const successText =
                `*ᥣᥲ ιmᥲgᥱn yᥲ fυᥱ sυbιdᥲ.* ${emoji}
*URL: ${catboxUrl}*`

            const linkPreview =
                await createLinkPreview(
                    conn,
                    catboxUrl,
                    'Iᴍᴀɢᴇɴ sᴜʙɪᴅᴀ',
                    `ɪᴍᴀɢᴇɴ ᴄᴏɴᴠᴇʀᴛɪᴅᴀ ᴇɴ ᴜʀʟ. ${emoji}`
                )

            if (linkPreview) {
                return conn.sendMessage(
                    m.chat,
                    {
                        text:
                            `\n${successText}`,

                        linkPreview
                    },
                    {
                        quoted: m
                    }
                )
            }

            return m.reply(
                `${successText}\n\n${catboxUrl}`
            )

        } catch (error) {

            console.error(
                '[TOURL] Error:',
                error
            )

            return m.reply(
                '*ɴᴏ ꜱᴇ ᴘᴜᴅᴏ ᴄᴏɴᴠᴇʀᴛɪʀ ʟᴀ ɪᴍᴀɢᴇɴ.*'
            )
        }
    }
}
