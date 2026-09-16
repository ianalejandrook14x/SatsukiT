import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { prepareWAMessageMedia } from '@itsliaaa/baileys'
import { initializeSubBot } from '../../lib/subbots.js'

export default {
    command: [
        'jadibot',
        'code',
        'codigo',
        'código'
    ],

    async run(m, { args, conn }) {

        let numero = null

        const argumentos = args || []

        const myNumber = argumentos.some(
            arg => String(arg).toLowerCase() === '-me'
        )

        if (myNumber) {

            const senderAlt =
                m.key?.participantAlt ||
                m.participantAlt ||
                null

            const sender =
                senderAlt ||
                m.sender ||
                m.key?.participant ||
                m.key?.remoteJid

            if (!sender) {
                return m.reply(
                    '*No se pudo obtener el número.*'
                )
            }

            numero = String(sender)
                .split('@')[0]
                .replace(/[^0-9]/g, '')

            if (!numero) {
                return m.reply(
                    '*No se pudo obtener el número.*'
                )
            }

        } else {

            numero = argumentos
                .join('')
                .replace(/[^0-9]/g, '')
        }

        if (!numero) {

            const previewUrl =
                'https://tewianix.org'

            const previewImage =
                'https://files.catbox.moe/rdn7sk.jpg'

            let linkPreview = null

            try {

                const imageResponse =
                    await fetch(previewImage)

                if (imageResponse.ok) {

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
                            'Jᴀᴅɪʙᴏᴛ',

                        description:
                            'ᴄᴏɴᴇᴄᴛᴀ ᴛᴜ ᴘʀᴏᴘɪᴏ ꜱᴏᴄᴋᴇᴛ',

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
                }

            } catch {}

            return conn.sendMessage(
                m.chat,
                {
                    text:
                        `${previewUrl}\n\n` +
                        `dᥱbᥱs ιᥒgrᥱsᥲr υᥒ ᥒúmᥱro ρᥲrᥲ obtᥱᥒᥱr ᥱᥣ ᥴodιgo dᥱ vιᥒᥴυᥣᥲᥴιóᥒ o υtιᥣιzᥲᥒdo *-mᥱ* sᥱgυιdo dᥱᥣ ᥴomᥲᥒdo\nᥱjᥱmρᥣo:\n\n` +
                        `*jᥲdιbot +549387xxxxxxx*\n*jᥲdιbot -mᥱ*`,

                    ...(linkPreview
                        ? { linkPreview }
                        : {})
                },
                {
                    quoted: m
                }
            )
        }

        const jid =
            `${numero}@s.whatsapp.net`

        let mensajeSat = null

        try {

            mensajeSat =
                await m.reply(
                    '*ꜱᴏʟɪᴄɪᴛᴀɴᴅᴏ ᴄᴏᴅɪɢᴏ -*'
                )

        } catch {}

        try {

            const safeJid =
                String(jid)
                    .replace(
                        /[^a-zA-Z0-9_-]/g,
                        '_'
                    )

            const subbotFolder =
                path.join(
                    process.cwd(),
                    'database',
                    'subbots',
                    safeJid
                )

            if (fs.existsSync(subbotFolder)) {

                try {

                    fs.rmSync(
                        subbotFolder,
                        {
                            recursive: true,
                            force: true
                        }
                    )

                } catch {}
            }

            const result =
                await initializeSubBot(
                    jid,
                    {
                        generatePairingCode:
                            true,

                        phoneNumber:
                            numero,

                        subbotOwner:
                            m.sender
                    }
                )

            if (
                !result ||
                !result.pairingCode
            ) {

                const errorText =
                    '*ᥒo sᥱ ρυdo gᥱᥒᥱrᥲr ᥱᥣ ᥴodιgo, ιᥒtᥱᥒtᥲ dᥱ ᥒυᥱvo ᥱᥒ υᥒos sᥱgυᥒdos*'

                if (
                    mensajeSat &&
                    typeof mensajeSat.edit ===
                        'function'
                ) {

                    await mensajeSat.edit(
                        errorText
                    )

                } else if (
                    mensajeSat?.key
                ) {

                    await conn.sendMessage(
                        m.chat,
                        {
                            text: errorText
                        },
                        {
                            edit:
                                mensajeSat.key
                        }
                    )

                } else {

                    await m.reply(
                        errorText
                    )
                }

                return
            }

            const codigoText =
                `${result.pairingCode}`

            if (
                mensajeSat &&
                typeof mensajeSat.edit ===
                    'function'
            ) {

                await mensajeSat.edit(
                    codigoText
                )

            } else if (
                mensajeSat?.key
            ) {

                await conn.sendMessage(
                    m.chat,
                    {
                        text: codigoText
                    },
                    {
                        edit:
                            mensajeSat.key
                    }
                )

            }

        } catch {

            const errorText =
                '*Error al generar código.*'

            try {

                if (
                    mensajeSat &&
                    typeof mensajeSat.edit ===
                        'function'
                ) {

                    await mensajeSat.edit(
                        errorText
                    )

                } else if (
                    mensajeSat?.key
                ) {

                    await conn.sendMessage(
                        m.chat,
                        {
                            text: errorText
                        },
                        {
                            edit:
                                mensajeSat.key
                        }
                    )

                } else {

                    await m.reply(
                        errorText
                    )
                }

            } catch {}
        }
    }
}
