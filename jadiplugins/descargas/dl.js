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

            console.log(
                `[DL] ${service.name}: ${originalUrl}`
            )

            console.log(
                `[DL] API: ${apiUrl}`
            )

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

            console.log(
                '[DL] Respuesta recibida'
            )

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

            const result =
                normalizeResult(
                    data,
                    service.type
                )

            if (
                service.type === 'spotify'
            ) {
                await sendSpotify(
                    conn,
                    m,
                    result,
                    emoji
                )
            } else {
                await sendSocialMedia(
                    conn,
                    m,
                    result,
                    service.type,
                    emoji
                )
            }

            await react(
                conn,
                m,
                '✅'
            )

            console.log(
                `[DL] ${service.name}: descarga completada`
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

function normalizeResult(
    data,
    type
) {
    const urls = []
    const images = []
    const audios = []
    const videos = []

    collectValues(
        data,
        urls,
        images,
        audios,
        videos
    )

    const title =
        firstValue(
            data,
            [
                'title',
                'name',
                'track',
                'caption',
                'description'
            ]
        )

    const author =
        firstValue(
            data,
            [
                'author',
                'artist',
                'username',
                'uploader',
                'creator'
            ]
        )

    const image =
        firstValue(
            data,
            [
                'image',
                'img',
                'thumbnail',
                'thumb',
                'cover',
                'cover_url',
                'coverUrl',
                'artwork'
            ]
        ) ||
        images[0] ||
        ''

    if (
        type === 'facebook' &&
        Array.isArray(
            data?.list
        )
    ) {
        for (
            const item of
                data.list
        ) {
            if (
                typeof item?.url ===
                'string' &&
                isUrl(item.url)
            ) {
                videos.push(
                    item.url
                )
            }
        }
    }

    if (
        type === 'spotify'
    ) {
        const spotifyAudio =
            findMediaByKeys(
                data,
                [
                    'download',
                    'downloadUrl',
                    'download_url',
                    'audio',
                    'audioUrl',
                    'audio_url',
                    'music',
                    'musicUrl',
                    'music_url'
                ]
            )

        if (spotifyAudio) {
            audios.unshift(
                spotifyAudio
            )
        }
    }

    return {
        raw:
            data,

        urls:
            unique(urls),

        images:
            unique(images),

        audios:
            unique(audios),

        videos:
            unique(videos),

        image:
            image,

        title:
            title || '',

        author:
            author || ''
    }
}

async function sendSpotify(
    conn,
    m,
    result,
    emoji
) {
    const title =
        result.title ||
        'Spotify'

    const author =
        result.author ||
        ''

    const caption =
        `${emoji} ${title}` +
        (
            author
                ? `\n${author}`
                : ''
        )

    if (result.image) {
        await conn.sendMessage(
            m.chat,
            {
                image: {
                    url:
                        result.image
                },
                caption
            },
            {
                quoted:
                    m
            }
        )
    }

    const audio =
        result.audios[0] ||
        findMediaByKeys(
            result.raw,
            [
                'download',
                'downloadUrl',
                'download_url',
                'audio',
                'audioUrl',
                'audio_url',
                'music',
                'musicUrl',
                'music_url',
                'url'
            ]
        )

    if (!audio) {
        throw new Error(
            'No se encontró el audio en la respuesta de Spotify.'
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

async function sendSocialMedia(
    conn,
    m,
    result,
    type,
    emoji
) {
    const caption =
        buildCaption(
            result,
            type,
            emoji
        )

    const videos =
        unique(
            result.videos
        )

    if (
        videos.length > 0
    ) {
        for (
            const video of
                videos
        ) {
            await conn.sendMessage(
                m.chat,
                {
                    video: {
                        url:
                            video
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

        return
    }

    const video =
        findMediaByKeys(
            result.raw,
            [
                'video',
                'videoUrl',
                'video_url',
                'play',
                'playUrl',
                'play_url',
                'hdplay',
                'hdPlay',
                'download',
                'downloadUrl',
                'download_url'
            ]
        )

    if (video) {
        await conn.sendMessage(
            m.chat,
            {
                video: {
                    url:
                        video
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

        return
    }

    const image =
        result.image ||
        result.images[0]

    if (image) {
        await conn.sendMessage(
            m.chat,
            {
                image: {
                    url:
                        image
                },

                caption
            },
            {
                quoted:
                    m
            }
        )

        return
    }

    const generic =
        result.urls.find(
            url =>
                isVideoUrl(url)
        )

    if (generic) {
        await conn.sendMessage(
            m.chat,
            {
                video: {
                    url:
                        generic
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

        return
    }

    throw new Error(
        'No se encontro archivo multimedia en la respuesta de la API.'
    )
}

function buildCaption(
    result,
    type,
    emoji
) {
    const service =
        type === 'tiktok'
            ? 'TikTok'
            : type === 'instagram'
                ? 'Instagram'
                : 'Facebook'

    let caption =
        `${emoji} ${service}`

    if (result.title) {
        caption +=
            `\n\n${result.title}`
    }

    if (result.author) {
        caption +=
            `\n${result.author}`
    }

    return caption
}

function collectValues(
    value,
    urls,
    images,
    audios,
    videos,
    key = ''
) {
    if (!value) {
        return
    }

    if (
        typeof value ===
        'string'
    ) {
        if (isUrl(value)) {
            urls.push(
                value
            )

            const lower =
                key.toLowerCase()

            if (
                isImageUrl(value) ||
                lower.includes(
                    'image'
                ) ||
                lower.includes(
                    'thumb'
                ) ||
                lower.includes(
                    'cover'
                ) ||
                lower.includes(
                    'thumbnail'
                )
            ) {
                images.push(
                    value
                )
            }

            if (
                isAudioUrl(value) ||
                lower.includes(
                    'audio'
                ) ||
                lower.includes(
                    'music'
                )
            ) {
                audios.push(
                    value
                )
            }

            if (
                isVideoUrl(value) ||
                lower.includes(
                    'video'
                ) ||
                lower.includes(
                    'play'
                )
            ) {
                videos.push(
                    value
                )
            }
        }

        return
    }

    if (
        Array.isArray(value)
    ) {
        for (
            const item of
                value
        ) {
            collectValues(
                item,
                urls,
                images,
                audios,
                videos,
                key
            )
        }

        return
    }

    if (
        typeof value ===
        'object'
    ) {
        for (
            const [
                childKey,
                childValue
            ] of Object.entries(
                value
            )
        ) {
            collectValues(
                childValue,
                urls,
                images,
                audios,
                videos,
                childKey
            )
        }
    }
}

function findMediaByKeys(
    object,
    keys
) {
    if (!object) {
        return ''
    }

    if (
        typeof object ===
        'string'
    ) {
        return isUrl(object)
            ? object
            : ''
    }

    if (
        Array.isArray(object)
    ) {
        for (
            const item of
                object
        ) {
            const found =
                findMediaByKeys(
                    item,
                    keys
                )

            if (found) {
                return found
            }
        }

        return ''
    }

    if (
        typeof object !==
        'object'
    ) {
        return ''
    }

    for (
        const key of
            keys
    ) {
        const value =
            object[key]

        if (
            typeof value ===
                'string' &&
            isUrl(value)
        ) {
            return value
        }
    }

    for (
        const value of
            Object.values(
                object
            )
    ) {
        const found =
            findMediaByKeys(
                value,
                keys
            )

        if (found) {
            return found
        }
    }

    return ''
}

function firstValue(
    object,
    keys
) {
    if (!object) {
        return ''
    }

    if (
        typeof object ===
        'string'
    ) {
        return object
    }

    if (
        Array.isArray(object)
    ) {
        for (
            const item of
                object
        ) {
            const found =
                firstValue(
                    item,
                    keys
                )

            if (found) {
                return found
            }
        }

        return ''
    }

    if (
        typeof object !==
        'object'
    ) {
        return ''
    }

    for (
        const key of
            keys
    ) {
        const value =
            object[key]

        if (
            typeof value ===
                'string' &&
            value.trim()
        ) {
            return value
        }

        if (
            value &&
            typeof value ===
                'object'
        ) {
            const found =
                firstValue(
                    value,
                    keys
                )

            if (found) {
                return found
            }
        }
    }

    for (
        const value of
            Object.values(
                object
            )
    ) {
        if (
            value &&
            typeof value ===
                'object'
        ) {
            const found =
                firstValue(
                    value,
                    keys
                )

            if (found) {
                return found
            }
        }
    }

    return ''
}

function isUrl(
    value
) {
    return /^https?:\/\/\S+$/i.test(
        value
    )
}

function isVideoUrl(
    url
) {
    return (
        /\.(mp4|m4v|mov|webm)(\?|$)/i
            .test(url) ||
        /\/video\b|\/v2\b|video_url|videoUrl/i
            .test(url)
    )
}

function isAudioUrl(
    url
) {
    return (
        /\.(mp3|m4a|aac|ogg|wav|opus)(\?|$)/i
            .test(url) ||
        /\/audio\b|audio_url|audioUrl/i
            .test(url)
    )
}

function isImageUrl(
    url
) {
    return (
        /\.(jpg|jpeg|png|webp|gif)(\?|$)/i
            .test(url) ||
        /\/image\b|\/thumb\b|\/thumbnail\b|\/cover\b/i
            .test(url)
    )
}

function unique(
    array
) {
    return [
        ...new Set(
            array.filter(
                Boolean
            )
        )
    ]
}

function sanitizeFileName(
    name
) {
    return (
        name
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
