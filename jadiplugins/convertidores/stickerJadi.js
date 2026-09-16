import { downloadContentFromMessage } from '@itsliaaa/baileys'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import config from '../../config.js'
import { getSubbotConfig } from '../../lib/subbotconfig.js'

async function streamToBuffer(stream) {
    let buffer = Buffer.alloc(0)

    for await (const chunk of stream) {
        buffer = Buffer.concat([
            buffer,
            chunk
        ])
    }

    return buffer
}

function convertToWebp(inputPath, isVideo) {
    return new Promise((resolve, reject) => {
        const tmpDir = path.join(
            process.cwd(),
            'tmp'
        )

        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(
                tmpDir,
                {
                    recursive: true
                }
            )
        }

        const tmpOutput = path.join(
            tmpDir,
            `${Date.now()}_sticker.webp`
        )

        const options = isVideo
            ? [
                '-vcodec',
                'libwebp',

                '-vf',
                'scale=320:320:force_original_aspect_ratio=decrease,fps=10,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=0x00000000',

                '-loop',
                '0',

                '-ss',
                '00:00:00',

                '-t',
                '00:00:06',

                '-preset',
                'default',

                '-an',

                '-vsync',
                '0'
            ]
            : [
                '-vcodec',
                'libwebp',

                '-vf',
                'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',

                '-preset',
                'default'
            ]

        ffmpeg(inputPath)
            .outputOptions(options)
            .toFormat('webp')
            .save(tmpOutput)
            .on('end', () => {
                try {
                    const resultBuffer =
                        fs.readFileSync(
                            tmpOutput
                        )

                    if (
                        fs.existsSync(
                            tmpOutput
                        )
                    ) {
                        fs.unlinkSync(
                            tmpOutput
                        )
                    }

                    resolve(
                        resultBuffer
                    )
                } catch (error) {
                    reject(error)
                }
            })
            .on('error', error => {
                if (
                    fs.existsSync(
                        tmpOutput
                    )
                ) {
                    fs.unlinkSync(
                        tmpOutput
                    )
                }

                reject(error)
            })
    })
}

function getBotJid(conn) {
    return (
        conn?.subBotJid ||
        conn?.user?.jid ||
        conn?.user?.id ||
        ''
    )
}

function getBotData(conn) {
    const botJid =
        getBotJid(conn)

    if (!botJid) {
        return {}
    }

    return getSubbotConfig(
        botJid,
        config
    )
}

function getStickerAuthor(conn) {
    const botData =
        getBotData(conn)

    const name =
        typeof botData?.name === 'string' &&
        botData.name.trim()
            ? botData.name.trim()
            : typeof config?.botName === 'string' &&
              config.botName.trim()
                ? config.botName.trim()
                : 'Jadibot'

    const emoji =
        typeof botData?.emoji === 'string' &&
        botData.emoji.trim()
            ? botData.emoji.trim()
            : '🍃'

    return `${name} | ${emoji}`
}

export default {
    command: [
        'sticker',
        's',
        'stiker'
    ],

    async run(
        m,
        {
            conn
        }
    ) {

        const q =
            m.quoted ||
            m

        const rawMessage =
            q?.message ||
            q?.msg ||
            q

        const type =
            Object.keys(
                rawMessage || {}
            ).find(
                key =>
                    key === 'imageMessage' ||
                    key === 'videoMessage' ||
                    key === 'stickerMessage'
            )

        const mediaContent =
            rawMessage?.[type] ||
            q

        if (
            !type &&
            !q?.mimetype
        ) {
            return m.reply(
                '*Responde con el comando a una imagen/video.*'
            )
        }

        const mime =
            mediaContent?.mimetype ||
            q?.mimetype ||
            ''

        if (
            mime.startsWith('video') &&
            Number(
                mediaContent?.seconds || 0
            ) > 7
        ) {
            return m.reply(
                '*El video no puede durar más de 7 segundos*'
            )
        }

        await m.reply(
            '*Enviando sticker*'
        )

        const tmpDir =
            path.join(
                process.cwd(),
                'tmp'
            )

        if (
            !fs.existsSync(
                tmpDir
            )
        ) {
            fs.mkdirSync(
                tmpDir,
                {
                    recursive: true
                }
            )
        }

        const ext =
            mime
                .split('/')[1]
                ?.split(';')[0] ||
            'tmp'

        const tmpInput =
            path.join(
                tmpDir,
                `${Date.now()}_input.${ext}`
            )

        try {

            let mediaBuffer

            try {

                const streamType =
                    mime.split('/')[0]

                const stream =
                    await downloadContentFromMessage(
                        mediaContent,
                        streamType
                    )

                mediaBuffer =
                    await streamToBuffer(
                        stream
                    )

            } catch {

                if (
                    typeof q?.download ===
                    'function'
                ) {
                    mediaBuffer =
                        await q.download()
                }
            }

            if (
                !mediaBuffer ||
                !mediaBuffer.length
            ) {
                throw new Error(
                    'No se pudo extraer el archivo multimedia.'
                )
            }

            fs.writeFileSync(
                tmpInput,
                mediaBuffer
            )

            const isVideo =
                mime.startsWith('video')

            const webpBuffer =
                await convertToWebp(
                    tmpInput,
                    isVideo
                )

            if (
                fs.existsSync(
                    tmpInput
                )
            ) {
                fs.unlinkSync(
                    tmpInput
                )
            }

            const author =
                getStickerAuthor(
                    conn
                )

            return await conn.sendMessage(
                m.chat,
                {
                    sticker:
                        webpBuffer,

                    packname:
                        author,

                    author:
                        ''
                },
                {
                    quoted: m
                }
            )

        } catch (error) {

            if (
                fs.existsSync(
                    tmpInput
                )
            ) {
                fs.unlinkSync(
                    tmpInput
                )
            }

            console.error(
                'Error en stickerJadi.js:',
                error
            )

            return m.reply(
                '*Ocurrio un error*\n\n' +
                `Detalle: ${error.message || error}`
            )
        }
    }
}
