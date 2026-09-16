import { downloadContentFromMessage } from '@itsliaaa/baileys'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Image } from 'node-webpmux'
import config from '../../config.js'
import { getSubbotConfig } from '../../lib/subbotconfig.js'

async function streamToBuffer(stream) {
    const chunks = []

    for await (const chunk of stream) {
        chunks.push(chunk)
    }

    return Buffer.concat(chunks)
}

function convertToWebp(inputPath, isVideo) {
    return new Promise((resolve, reject) => {
        const tmpDir = path.join(process.cwd(), 'tmp')

        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true })
        }

        const tmpOutput = path.join(
            tmpDir,
            `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_sticker.webp`
        )

        const options = isVideo
            ? [
                '-vcodec', 'libwebp',
                '-vf',
                'scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,' +
                'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0,' +
                'fps=10',
                '-pix_fmt', 'yuva420p',
                '-loop', '0',
                '-ss', '00:00:00',
                '-t', '00:00:07',
                '-preset', 'default',
                '-an',
                '-vsync', '0'
            ]
            : [
                '-vcodec', 'libwebp',
                '-vf',
                'scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,' +
                'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0',
                '-pix_fmt', 'yuva420p',
                '-preset', 'default',
                '-an'
            ]

        ffmpeg(inputPath)
            .outputOptions(options)
            .toFormat('webp')
            .save(tmpOutput)
            .on('end', () => {
                try {
                    const result = fs.readFileSync(tmpOutput)

                    if (fs.existsSync(tmpOutput)) {
                        fs.unlinkSync(tmpOutput)
                    }

                    resolve(result)
                } catch (error) {
                    reject(error)
                }
            })
            .on('error', error => {
                if (fs.existsSync(tmpOutput)) {
                    fs.unlinkSync(tmpOutput)
                }

                reject(error)
            })
    })
}

async function addExif(webpBuffer, packname, author, emojis = ['']) {
    const img = new Image()

    await img.load(webpBuffer)

    const stickerPackId = crypto.randomBytes(32).toString('hex')

    const json = {
        'sticker-pack-id': stickerPackId,
        'sticker-pack-name': packname,
        'sticker-pack-publisher': author,
        'emojis': emojis
    }

    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')

    const exifHeader = Buffer.from([
        0x49, 0x49, 0x2A, 0x00,
        0x08, 0x00, 0x00, 0x00,
        0x01, 0x00,
        0x41, 0x57,
        0x07, 0x00,
        0x00, 0x00,
        0x16, 0x00, 0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00
    ])

    const exif = Buffer.concat([
        exifHeader,
        jsonBuffer
    ])

    img.exif = exif

    return await img.save(null)
}

function getBotJid(conn) {
    return conn?.subBotJid ||
        conn?.user?.jid ||
        conn?.user?.id ||
        ''
}

function getBotData(conn) {
    const botJid = getBotJid(conn)

    if (!botJid) {
        return {}
    }

    return getSubbotConfig(botJid, config)
}

function getStickerData(conn) {
    const botData = getBotData(conn)

    const name =
        typeof botData?.name === 'string' && botData.name.trim()
            ? botData.name.trim()
            : typeof config?.botName === 'string' && config.botName.trim()
                ? config.botName.trim()
                : 'Jadibot'

    const emoji =
        typeof botData?.emoji === 'string' && botData.emoji.trim()
            ? botData.emoji.trim()
            : '🍃'

    return {
        name,
        emoji,
        packname: `${name} | ${emoji}`
    }
}

async function react(m, conn, text) {
    try {
        if (typeof m.react === 'function') {
            return await m.react(text)
        }

        if (conn?.sendMessage && m?.chat && m?.key) {
            return await conn.sendMessage(
                m.chat,
                {
                    react: {
                        text,
                        key: m.key
                    }
                }
            )
        }
    } catch {}
}

export default {
    command: ['sticker', 's', 'stiker'],

    async run(m, { conn }) {
        const q = m.quoted || m
        const rawMessage = q?.message || q?.msg || q

        const type = Object.keys(rawMessage || {}).find(
            key =>
                key === 'imageMessage' ||
                key === 'videoMessage'
        )

        if (!type && !q?.mimetype) {
            return m.reply('*Responde con el comando a una imagen/video.*')
        }

        const mediaContent = rawMessage?.[type] || q
        const mime = mediaContent?.mimetype || q?.mimetype || ''

        const isVideo = mime.startsWith('video')
        const isImage = mime.startsWith('image')

        if (!isVideo && !isImage) {
            return m.reply('*Responde con el comando a una imagen/video.*')
        }

        if (
            isVideo &&
            Number(mediaContent?.seconds || 0) > 7
        ) {
            return m.reply('El video no puede durar más de 7 segundos.')
        }

        await react(m, conn, '🕗')

        let inputPath = ''
        let outputBuffer = null

        try {
            const stream = await downloadContentFromMessage(
                mediaContent,
                isVideo ? 'video' : 'image'
            )

            const mediaBuffer = await streamToBuffer(stream)

            if (!mediaBuffer?.length) {
                throw new Error('No se pudo descargar el archivo multimedia.')
            }

            const tmpDir = path.join(process.cwd(), 'tmp')

            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true })
            }

            const extension = isVideo ? 'mp4' : 'jpg'

            inputPath = path.join(
                tmpDir,
                `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${extension}`
            )

            fs.writeFileSync(inputPath, mediaBuffer)

            outputBuffer = await convertToWebp(
                inputPath,
                isVideo
            )

            if (!outputBuffer?.length) {
                throw new Error('FFmpeg no generó un sticker válido.')
            }

            const stickerData = getStickerData(conn)

            const finalWebp = await addExif(
                outputBuffer,
                stickerData.packname,
                '',
                [stickerData.emoji]
            )

            if (!finalWebp?.length) {
                throw new Error('No se pudo generar el WebP final.')
            }

            await conn.sendMessage(
                m.chat,
                {
                    sticker: finalWebp
                },
                {
                    quoted: m
                }
            )

            await react(m, conn, '✅')
        } catch (error) {
            console.error('Error creando sticker:', error)

            await react(m, conn, '❌')

            return m.reply(
                `Error al crear el sticker.\n\n${error?.message || error}`
            )
        } finally {
            if (inputPath && fs.existsSync(inputPath)) {
                try {
                    fs.unlinkSync(inputPath)
                } catch {}
            }
        }
    }
}
