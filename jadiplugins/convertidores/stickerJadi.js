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

function addExif(webpBuffer, packname, author) {
    const json = {
        'sticker-pack-id': 'com.whatsapp.sticker.jadibot',
        'sticker-pack-name': packname,
        'sticker-pack-publisher': author,
        'emojis': ['']
    }

    const jsonBuffer = Buffer.from(
        JSON.stringify(json),
        'utf8'
    )

    const exifHeader = Buffer.from([
        0x49, 0x49, 0x2A, 0x00,
        0x08, 0x00, 0x00, 0x00,
        0x01, 0x00,
        0x41, 0x57,
        0x07, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00
    ])

    const exifBuffer = Buffer.concat([
        exifHeader,
        jsonBuffer
    ])

    exifBuffer.writeUInt32LE(
        jsonBuffer.length,
        14
    )

    if (
        webpBuffer.toString(
            'ascii',
            0,
            4
        ) !== 'RIFF'
    ) {
        throw new Error(
            'El archivo generado no es un WebP válido.'
        )
    }

    if (
        webpBuffer.toString(
            'ascii',
            8,
            12
        ) !== 'WEBP'
    ) {
        throw new Error(
            'El archivo generado no contiene un contenedor WEBP válido.'
        )
    }

    const chunks = []

    let offset = 12

    while (
        offset + 8 <= webpBuffer.length
    ) {
        const chunkType =
            webpBuffer.toString(
                'ascii',
                offset,
                offset + 4
            )

        const chunkSize =
            webpBuffer.readUInt32LE(
                offset + 4
            )

        const totalSize =
            8 +
            chunkSize +
            (chunkSize % 2)

        if (
            offset + totalSize >
            webpBuffer.length
        ) {
            break
        }

        chunks.push(
            webpBuffer.subarray(
                offset,
                offset + totalSize
            )
        )

        offset += totalSize
    }

    const exifSize =
        exifBuffer.length

    const paddedSize =
        exifSize % 2 === 0
            ? exifSize
            : exifSize + 1

    const exifChunk =
        Buffer.alloc(
            8 + paddedSize
        )

    exifChunk.write(
        'EXIF',
        0,
        4,
        'ascii'
    )

    exifChunk.writeUInt32LE(
        exifSize,
        4
    )

    exifBuffer.copy(
        exifChunk,
        8
    )

    const newBody =
        Buffer.concat([
            Buffer.from('WEBP', 'ascii'),
            ...chunks,
            exifChunk
        ])

    const newRiff =
        Buffer.alloc(8)

    newRiff.write(
        'RIFF',
        0,
        4,
        'ascii'
    )

    newRiff.writeUInt32LE(
        newBody.length,
        4
    )

    return Buffer.concat([
        newRiff,
        newBody
    ])
}

function convertToWebp(
    inputPath,
    isVideo
) {
    return new Promise(
        (resolve, reject) => {

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

            const tmpOutput =
                path.join(
                    tmpDir,
                    `${Date.now()}_sticker.webp`
                )

            const options = isVideo
                ? [
                    '-vcodec',
                    'libwebp',

                    '-vf',
                    'scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,fps=10,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0',

                    '-pix_fmt',
                    'yuva420p',

                    '-lossless',
                    '1',

                    '-loop',
                    '0',

                    '-ss',
                    '00:00:00',

                    '-t',
                    '00:00:07',

                    '-preset',
                    'picture',

                    '-an',

                    '-vsync',
                    '0'
                ]
                : [
                    '-vcodec',
                    'libwebp',

                    '-vf',
                    'scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0',

                    '-pix_fmt',
                    'yuva420p',

                    '-lossless',
                    '1',

                    '-preset',
                    'picture',

                    '-an'
                ]

            ffmpeg(inputPath)
                .outputOptions(
                    options
                )
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
        }
    )
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

async function react(
    m,
    conn,
    text
) {
    try {

        if (
            typeof m?.react ===
            'function'
        ) {
            return await m.react(
                text
            )
        }

        if (
            conn?.sendMessage &&
            m?.chat &&
            m?.key
        ) {
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
                '*El video no puede durar más de 7 segundos.*'
            )
        }

        await react(
            m,
            conn,
            '🕗'
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
                    mime.startsWith('video')
                        ? 'video'
                        : 'image'

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

            const stickerInfo =
                getStickerAuthor(
                    conn
                )

            const finalWebp =
                addExif(
                    webpBuffer,
                    stickerInfo,
                    ''
                )

            await conn.sendMessage(
                m.chat,
                {
                    sticker:
                        finalWebp
                },
                {
                    quoted: m
                }
            )

            await react(
                m,
                conn,
                '✅'
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

            await react(
                m,
                conn,
                '❌'
            )

            return m.reply(
                '*Ocurrio un error al crear el sticker.*\n\n' +
                `Detalle: ${error.message || error}`
            )
        }
    }
}
