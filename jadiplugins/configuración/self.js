import sharp from 'sharp'
import { prepareWAMessageMedia } from '@itsliaaa/baileys'
import {
    getSubbotConfig,
    saveSubbotConfig
} from '../../lib/subbotconfig.js'
import config from '../../config.js'

function decodeNumber(target) {
    if (!target) return ''

    return String(target)
        .split('@')[0]
        .split(':')[0]
        .replace(/[^0-9]/g, '')
}

function getBotJid(conn) {
    return (
        conn?.subBotJid ||
        conn?.user?.jid ||
        conn?.user?.id ||
        ''
    )
}

function isMainOwner(sender) {
    const senderNumber =
        decodeNumber(sender)

    if (!senderNumber) return false

    const owners = Array.isArray(config?.owners)
        ? config.owners
        : []

    return owners.some(owner => {
        const ownerNumber =
            decodeNumber(owner)

        return (
            ownerNumber &&
            ownerNumber === senderNumber
        )
    })
}

function isSubbotOwner(m, conn, botConfig, botJid) {
    const sender =
        m?.key?.participantAlt ||
        m?.participantAlt ||
        m?.sender ||
        m?.key?.participant ||
        m?.key?.remoteJid ||
        ''

    const senderNumber =
        decodeNumber(sender)

    if (!senderNumber) return false

    const botNumber =
        decodeNumber(botJid)

    const configuredOwner =
        decodeNumber(
            botConfig?.ownerNumber
        )

    const subbotOwner =
        decodeNumber(
            conn?.subbotOwner
        )

    if (
        configuredOwner &&
        configuredOwner === senderNumber
    ) {
        return true
    }

    if (
        subbotOwner &&
        subbotOwner === senderNumber
    ) {
        return true
    }

    if (
        botNumber &&
        botNumber === senderNumber
    ) {
        return true
    }

    return false
}

export default {
    command: ['self'],

    async run(m, { conn, args, usedPrefix }) {

        const botJid =
            getBotJid(conn)

        if (!botJid) return

        const botConfig =
            getSubbotConfig(botJid)

        const sender =
            m?.key?.participantAlt ||
            m?.participantAlt ||
            m?.sender ||
            m?.key?.participant ||
            m?.key?.remoteJid ||
            ''

        const ownerPrincipal =
            isMainOwner(sender)

        const ownerSubbot =
            isSubbotOwner(
                m,
                conn,
                botConfig,
                botJid
            )

        if (
            !ownerPrincipal &&
            !ownerSubbot
        ) {
            return
        }

        const botEmoji =
            typeof botConfig?.emoji === 'string' &&
            botConfig.emoji.trim()
                ? botConfig.emoji.trim()
                : '🍃'

        const currentSelf =
            botConfig?.self === 'on'
                ? 'on'
                : 'off'

        const option =
            args?.[0]?.toLowerCase()

        if (!option) {

            const selfText =
                `ᥱᥣ modo sᥱᥣf ᥱs ρᥲrᥲ ᥲᥴtιvᥲr o dᥱsᥲᥴtιvᥲr ᥱᥣ modo ρrιvᥲdo dᥱᥣ jᥲdιbot ᥱstᥲbᥣᥱᥴᥱrᥣo ᥴomo ρúbᥣιᥴo o ρrιvᥲdo. ${botEmoji}

ᥱstᥲdo ᥲᥴtυᥲᥣ: *${currentSelf.toUpperCase()}* ${botEmoji}

${usedPrefix}sᥱᥣf oᥒ
${usedPrefix}sᥱᥣf off`
                .trim()

            const previewUrl =
                'https://tewianix.org'

            const previewImage =
                botConfig?.mediaUrl ||
                'https://files.catbox.moe/rdn7sk.jpg'

            let linkPreview = null

            try {

                const imageResponse =
                    await fetch(previewImage)

                if (!imageResponse.ok) {
                    throw new Error()
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
                        'ꜱᴇʟꜰ ᴍᴏᴅᴏ',

                    description:
                        `ᴇꜱᴛᴀᴅᴏ: ${currentSelf.toUpperCase()}`,

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

            } catch {}

            if (linkPreview) {

                return await conn.sendMessage(
                    m.chat,
                    {
                        text:
                            `${previewUrl}\n\n${selfText}`,

                        linkPreview
                    },
                    {
                        quoted: m
                    }
                )
            }

            return m.reply(
                selfText
            )
        }

        if (option === 'on') {

            if (currentSelf === 'on') {
                return m.reply(
                    `*modo sᥱᥣf yᥲ ᥱstᥲ ᥲᥴtιvᥲdo*`
                )
            }

            await saveSubbotConfig(
                botJid,
                {
                    self: 'on'
                }
            )

            return m.reply(
                `*modo sᥱᥣf ᥲᥴtιvᥲdo*\n\nsᥱ ᥱstᥲbᥣᥱᥴιo ᥱᥣ modo ρrιvᥲdo.`
            )
        }

        if (option === 'off') {

            if (currentSelf === 'off') {
                return m.reply(
                    `*modo sᥱᥣf yᥲ ᥱstᥲ dᥱsᥲᥴtιvᥲdo*`
                )
            }

            await saveSubbotConfig(
                botJid,
                {
                    self: 'off'
                }
            )

            return m.reply(
                `*modo sᥱᥣf dᥱsᥲᥴtιvᥲdo*\n\nᥱᥣ jᥲdιbot sᥱ ᥱstᥲbᥣᥱᥴιo ᥱᥒ modo ρúbᥣιᥴo.`
            )
        }

        return m.reply(
            `*oρᥴιoᥒᥱs dιsρoᥒιbᥣᥱs*\n\n${usedPrefix}sᥱᥣf oᥒ\n${usedPrefix}sᥣᥱf off`
        )
    }
}
