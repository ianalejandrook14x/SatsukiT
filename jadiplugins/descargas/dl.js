import sharp from 'sharp'
import { prepareWAMessageMedia } from '@itsliaaa/baileys'
import { getSubbotConfig } from '../../lib/subbotconfig.js'

export default {
    command: [
        'dl'
    ],

    async run(m, { conn, args, text }) {
        const botJid =
            conn?.subBotJid ||
            conn?.user?.jid ||
            conn?.user?.id ||
            ''

        const botConfig =
            getSubbotConfig(botJid)

        const emoji =
            typeof botConfig?.emoji === 'string' &&
            botConfig.emoji.trim()
                ? botConfig.emoji.trim()
                : '🍃'

        try {
            const input =
                Array.isArray(args) && args.length
                    ? args.join(' ').trim()
                    : typeof text === 'string'
                        ? text.trim()
                        : ''

            if (!input) {
                return await sendDownloadMenu(
                    m,
                    conn,
                    botConfig
                )
            }

            const urlMatch =
                input.match(
                    /https?:\/\/[^\s]+/i
                )

            if (!urlMatch) {
                await react(
                    conn,
                    m,
                    '❌'
                )

                return m.reply(
                    `${emoji} Debes proporcionar una URL válida.`
                )
            }

            const originalUrl =
                cleanUrl(
                    urlMatch[0]
                )

            const service =
                detectService(
                    originalUrl
                )

            if (!service) {
                await react(
                    conn,
                    m,
                    '❌'
                )

                return m.reply(
                    `${emoji} Esta URL no esta en los metodos de descargas disponibles`
                )
            }

            await react(
                conn,
                m,
                '🕗'
            )

            const apiUrl =
                `${service.api}?url=${encodeURIComponent(originalUrl)}`

            const response =
                await fetch(
                    apiUrl,
                    {
                        method: 'GET',

                        headers: {
                            Accept:
                                'application/json',

                            'User-Agent':
                                'Mozilla/5.0'
                        },

                        signal:
                            AbortSignal.timeout(
                                60000
                            )
                    }
                )

            const contentType =
                response.headers.get(
                    'content-type'
                ) || ''

            const responseText =
                await response.text()

            if (!response.ok) {
                throw new Error(
                    `La API respondió HTTP ${response.status}.`
                )
            }

            if (
                !contentType.includes(
                    'application/json'
                )
            ) {
                throw new Error(
                    `La API no devolvió JSON. Respuesta: ${responseText.slice(0, 300)}`
                )
            }

            let data

            try {
                data =
                    JSON.parse(
                        responseText
                    )
            } catch {
                throw new Error(
                    'La respuesta de la API no contiene un JSON válido.'
                )
            }

            if (
                data?.status === false ||
                data?.success === false
            ) {
                throw new Error(
                    data?.message ||
                    data?.error ||
                    'La API no pudo procesar la URL.'
                )
            }

            if (
                service.type === 'tiktok'
            ) {
                await sendTikTok(
                    conn,
                    m,
                    data,
                    emoji
                )
            } else if (
                service.type === 'spotify'
            ) {
                await sendSpotify(
                    conn,
                    m,
                    data,
                    botConfig,
                    emoji
                )
            } else if (
                service.type === 'instagram'
            ) {
                await sendInstagram(
                    conn,
                    m,
                    data,
                    emoji
                )
            } else if (
                service.type === 'facebook'
            ) {
                await sendFacebook(
                    conn,
                    m,
                    data,
                    emoji
                )
            }

            await react(
                conn,
                m,
                '✅'
            )

        } catch (error) {
            console.error(
                '[DL ERROR]',
                error
            )

            try {
                await react(
                    conn,
                    m,
                    '❌'
                )
            } catch {}

            return m.reply(
                `${emoji} No se pudo realizar la descarga.\n\n` +
                `${error?.message || 'Error desconocido.'}`
            )
        }
    }
}

async function sendDownloadMenu(
    m,
    conn,
    botConfig
) {
    const botName =
        botConfig?.name ||
        'tᥱwιᥲᥒιx'

    const ownerName =
        botConfig?.ownerName ||
        'sᥲtsυkι tᥲᥴhιbᥲᥒᥲ'

    const emoji =
        typeof botConfig?.emoji === 'string' &&
        botConfig.emoji.trim()
            ? botConfig.emoji.trim()
            : '🍃'

    const previewUrl =
        'https://tewianix.org'

    const previewImage =
        botConfig?.mediaUrl ||
        'https://files.catbox.moe/rdn7sk.jpg'

    const menuText =
        `Tipo de Descargas disponibles\n\n` +
        `${emoji} Spotify [URL]\n` +
        `${emoji} Instagram [URL]\n` +
        `${emoji} Facebook [URL]\n` +
        `${emoji} Tiktok [URL]`

    let linkPreview = null

    try {
        const imageResponse =
            await fetch(
                previewImage,
                {
                    signal:
                        AbortSignal.timeout(
                            15000
                        )
                }
            )

        if (!imageResponse.ok) {
            throw new Error(
                `HTTP ${imageResponse.status}`
            )
        }

        const originalBuffer =
            Buffer.from(
                await imageResponse.arrayBuffer()
            )

        const thumbnailBuffer =
            await sharp(
                originalBuffer
            )
                .resize(
                    1280,
                    720,
                    {
                        fit: 'cover',
                        position: 'center'
                    }
                )
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
            imageMessage.width =
                1280

            imageMessage.height =
                720
        }

        linkPreview = {
            'canonical-url':
                previewUrl,

            'matched-text':
                previewUrl,

            title:
                botName,

            description:
                `for ${ownerName}`,

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

    } catch (error) {
        console.error(
            '[DL PREVIEW]',
            error
        )
    }

    if (linkPreview) {
        return conn.sendMessage(
            m.chat,
            {
                text:
                    `${previewUrl}\n\n${menuText}`,

                linkPreview
            },
            {
                quoted:
                    m
            }
        )
    }

    return m.reply(
        menuText
    )
}

async function sendTikTok(
    conn,
    m,
    data,
    emoji
) {
    const id =
        data?.data?.id ||
        data?.id ||
        'Desconocido'

    const region =
        data?.data?.region ||
        data?.region ||
        'Desconocida'

    const title =
        data?.data?.title ||
        data?.title ||
        'Sin título'

    const authorUsername =
        data?.data?.author?.username ||
        data?.author?.username ||
        'Desconocido'

    const authorNickname =
        data?.data?.author?.nickname ||
        data?.author?.nickname ||
        'Desconocido'

    const durationValue =
        data?.data?.duration ??
        data?.duration

    const duration =
        durationValue !== undefined
            ? `${durationValue}s`
            : 'Desconocida'

    const repro =
        data?.data?.repro ??
        data?.repro ??
        '0'

    const like =
        data?.data?.like ??
        data?.like ??
        '0'

    const share =
        data?.data?.share ??
        data?.share ??
        '0'

    const comment =
        data?.data?.comment ??
        data?.comment ??
        '0'

    const download =
        data?.data?.download ??
        data?.download ??
        '0'

    const published =
        data?.data?.published ||
        data?.published ||
        'Desconocida'

    const musicTitle =
        data?.data?.music?.title ||
        data?.music?.title ||
        'Sin información'

    const musicAuthor =
        data?.data?.music?.author ||
        data?.music?.author ||
        'Desconocido'

    const media =
        Array.isArray(data?.data?.meta?.media)
            ? data.data.meta.media
            : Array.isArray(data?.data?.media)
                ? data.data.media
                : Array.isArray(data?.meta?.media)
                    ? data.meta.media
                    : Array.isArray(data?.media)
                        ? data.media
                        : []

    const videoDataRef =
        media.find(
            item =>
                item?.type === 'video'
        )

    const sizeHd =
        videoDataRef?.size_hd

    const videoUrl =
        videoDataRef?.hd

    if (!videoUrl) {
        throw new Error(
            'No se encontró el video HD de TikTok en la respuesta de la API.'
        )
    }

    let sizeInfo = ''

    if (sizeHd) {
        sizeInfo =
            `${emoji} ━━ ρᥱso: ${sizeHd}\n`
    }

    const caption =
        `  ━━━━━━━━━ ᴛɪᴋᴛᴏᴋ ━━━━━━━━━     \n\n` +

        `${emoji} ━ tιtυᥣo: ${title}\n` +
        `${emoji} ━ ᥴrᥱᥲdor: ${authorNickname} / ${authorUsername}\n` +
        `${emoji} ━ ιd: ${id}\n` +
        `${emoji} ━ rᥱgιóᥒ: ${region}\n` +
        `${emoji} ━ dυrᥲᥴιóᥒ: ${duration}\n` +
        `${sizeInfo}` +
        `${emoji} ━ vιstᥲs: ${repro}\n` +
        `${emoji} ━ ᥣιkᥱs: ${like}\n` +
        `${emoji} ━ ᥴomρᥲrtιdos: ${share}\n` +
        `${emoji} ━ ᥴomᥱᥒtᥲrιos: ${comment}\n` +
        `${emoji} ━ dᥱsᥴᥲrgᥲs: ${download}\n` +
        `${emoji} ━ ρυbᥣιᥴᥲdo: ${published}\n\n` +

        `✦ ━━━━━━━━ ᴀᴜᴅɪᴏ ━━━━━━━━ ✦\n\n` +

        `${emoji} ━ mυsιᥴᥲ: ${musicTitle}\n` +
        `${emoji} ━ ᥲυtor: ${musicAuthor}`

    await conn.sendMessage(
        m.chat,
        {
            video: {
                url:
                    videoUrl
            },

            caption,

            mimetype:
                'video/mp4'
        },
        {
            quoted:
                m
        }
    )
}

async function sendSpotify(
    conn,
    m,
    data,
    botConfig,
    emoji
) {
    const spotifyData =
        data?.data ||
        data

    const title =
        spotifyData?.title ||
        'Sin título'

    const author =
        spotifyData?.author ||
        'Desconocido'

    const image =
        spotifyData?.image

    const audio =
        spotifyData?.download

    if (!image) {
        throw new Error(
            'Spotify no devolvió una imagen para el link preview.'
        )
    }

    if (!audio) {
        throw new Error(
            'Spotify no devolvió el enlace de descarga.'
        )
    }

    const name =
        botConfig?.name ||
        'tᥱwιᥲᥒιx'

    const previewText =
        `${emoji} Titulo: ${title}\n` +
        `${emoji} Autor: ${author}\n` +
        `${emoji} Socket: ${name}`

    const linkPreview =
        await createLinkPreview(
            conn,
            image,
            title,
            author,
            image
        )

    if (!linkPreview) {
        await conn.sendMessage(
            m.chat,
            {
                image: {
                    url:
                        image
                },

                caption:
                    previewText
            },
            {
                quoted:
                    m
            }
        )
    } else {
        await conn.sendMessage(
            m.chat,
            {
                text:
                    `${image}\n\n${previewText}`,

                linkPreview
            },
            {
                quoted:
                    m
            }
        )
    }

    await conn.sendMessage(
        m.chat,
        {
            audio: {
                url:
                    audio
            },

            mimetype:
                'audio/mpeg',

            fileName:
                `${sanitizeFileName(title)}.mp3`
        },
        {
            quoted:
                m
        }
    )
}

async function sendInstagram(
    conn,
    m,
    data,
    emoji
) {
    const media =
        Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data)
                ? data
                : []

    if (!media.length) {
        throw new Error(
            'Instagram no devolvió archivos multimedia.'
        )
    }

    const caption =
        `${emoji} Instagram | DL`

    let sent = false

    for (
        const item of media
    ) {
        if (
            !item?.url
        ) {
            continue
        }

        if (
            item.type === 'video'
        ) {
            await conn.sendMessage(
                m.chat,
                {
                    video: {
                        url:
                            item.url
                    },

                    caption,

                    mimetype:
                        'video/mp4'
                },
                {
                    quoted:
                        m
                }
            )
        } else {
            await conn.sendMessage(
                m.chat,
                {
                    image: {
                        url:
                            item.url
                    },

                    caption
                },
                {
                    quoted:
                        m
                }
            )
        }

        sent = true
    }

    if (!sent) {
        throw new Error(
            'Instagram no devolvió una URL multimedia válida.'
        )
    }
}

async function sendFacebook(
    conn,
    m,
    data,
    emoji
) {
    const list =
        Array.isArray(data?.list)
            ? data.list
            : []

    const video =
        list.find(
            item =>
                typeof item?.url === 'string' &&
                item.url.trim()
        )

    if (!video?.url) {
        throw new Error(
            'Facebook no devolvió un enlace de descarga.'
        )
    }

    const caption =
        `${emoji} Facebook | DL`

    await conn.sendMessage(
        m.chat,
        {
            video: {
                url:
                    video.url
            },

            caption,

            mimetype:
                'video/mp4'
        },
        {
            quoted:
                m
        }
    )
}

async function createLinkPreview(
    conn,
    previewImage,
    title,
    description,
    canonicalUrl
) {
    try {
        const imageResponse =
            await fetch(
                previewImage,
                {
                    signal:
                        AbortSignal.timeout(
                            15000
                        )
                }
            )

        if (!imageResponse.ok) {
            throw new Error(
                `HTTP ${imageResponse.status}`
            )
        }

        const originalBuffer =
            Buffer.from(
                await imageResponse.arrayBuffer()
            )

        const thumbnailBuffer =
            await sharp(
                originalBuffer
            )
                .resize(
                    1280,
                    720,
                    {
                        fit: 'cover',
                        position: 'center'
                    }
                )
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
            imageMessage.width =
                1280

            imageMessage.height =
                720
        }

        return {
            'canonical-url':
                canonicalUrl,

            'matched-text':
                canonicalUrl,

            title:
                title,

            description:
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

    } catch (error) {
        console.error(
            '[DL LINK PREVIEW]',
            error
        )

        return null
    }
}

async function react(
    conn,
    m,
    text
) {
    return conn.sendMessage(
        m.chat,
        {
            react: {
                text,
                key:
                    m.key
            }
        }
    )
}

function cleanUrl(
    url
) {
    return String(url)
        .replace(
            /[)>]+$/,
            ''
        )
        .trim()
}

function detectService(
    url
) {
    let hostname

    try {
        hostname =
            new URL(url)
                .hostname
                .toLowerCase()
    } catch {
        return null
    }

    hostname =
        hostname.replace(
            /^www\./,
            ''
        )

    if (
        hostname === 'open.spotify.com' ||
        hostname === 'spotify.com' ||
        hostname.endsWith(
            '.spotify.com'
        )
    ) {
        return {
            type:
                'spotify',

            name:
                'Spotify',

            api:
                'https://api.delirius.online/download/spotifydl'
        }
    }

    if (
        hostname === 'tiktok.com' ||
        hostname.endsWith(
            '.tiktok.com'
        ) ||
        hostname === 'vt.tiktok.com' ||
        hostname === 'vm.tiktok.com'
    ) {
        return {
            type:
                'tiktok',

            name:
                'TikTok',

            api:
                'https://api.delirius.online/download/tiktok'
        }
    }

    if (
        hostname === 'instagram.com' ||
        hostname.endsWith(
            '.instagram.com'
        )
    ) {
        return {
            type:
                'instagram',

            name:
                'Instagram',

            api:
                'https://api.delirius.online/download/instagram'
        }
    }

    if (
        hostname === 'facebook.com' ||
        hostname.endsWith(
            '.facebook.com'
        ) ||
        hostname === 'fb.watch'
    ) {
        return {
            type:
                'facebook',

            name:
                'Facebook',

            api:
                'https://api.delirius.online/download/facebook'
        }
    }

    return null
}

function sanitizeFileName(
    name
) {
    return (
        String(name)
            .replace(
                /[<>:"/\\|?*\x00-\x1F]/g,
                ''
            )
            .trim()
            .slice(
                0,
                100
            ) ||
        'spotify'
    )
}
