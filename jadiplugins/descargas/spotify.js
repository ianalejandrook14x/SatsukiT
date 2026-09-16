import sharp from 'sharp'
import { prepareWAMessageMedia } from '@itsliaaa/baileys'
import { getSubbotConfig } from '../lib/subbotconfig.js'

function getSpotifyTrackId(url) {
    try {
        const parsed = new URL(url)

        if (
            parsed.hostname !== 'open.spotify.com' &&
            parsed.hostname !== 'spotify.com' &&
            parsed.hostname !== 'www.spotify.com'
        ) {
            return null
        }

        const parts = parsed.pathname
            .split('/')
            .filter(Boolean)

        if (
            parts.length < 2 ||
            parts[0].toLowerCase() !== 'track'
        ) {
            return null
        }

        const trackId = parts[1]

        if (!/^[A-Za-z0-9]+$/.test(trackId)) {
            return null
        }

        return trackId
    } catch {
        return null
    }
}

async function getSpotifyTrack(trackId) {
    const token =
        process.env.SPOTIFY_ACCESS_TOKEN

    if (!token) {
        throw new Error(
            'No existe SPOTIFY_ACCESS_TOKEN.'
        )
    }

    const response = await fetch(
        `https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            },
            signal: AbortSignal.timeout(15000)
        }
    )

    if (!response.ok) {
        const body = await response.text()

        throw new Error(
            `Spotify API HTTP ${response.status}: ${body}`
        )
    }

    return response.json()
}

async function createLinkPreview({
    conn,
    imageUrl,
    spotifyUrl,
    title,
    description
}) {
    try {
        if (!imageUrl) {
            return null
        }

        const imageResponse = await fetch(
            imageUrl,
            {
                signal:
                    AbortSignal.timeout(15000)
            }
        )

        if (!imageResponse.ok) {
            throw new Error(
                `Imagen HTTP ${imageResponse.status}`
            )
        }

        const originalBuffer =
            Buffer.from(
                await imageResponse.arrayBuffer()
            )

        const thumbnailBuffer =
            await sharp(originalBuffer)
                .jpeg({
                    quality: 90
                })
                .toBuffer()

        const {
            imageMessage
        } = await prepareWAMessageMedia(
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
            imageMessage.width = 640
            imageMessage.height = 640
        }

        return {
            'canonical-url':
                spotifyUrl,

            'matched-text':
                spotifyUrl,

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
    } catch (error) {
        console.error(
            '[SPOTIFY] Error creando preview:',
            error
        )

        return null
    }
}

async function sendJadibotHelp(
    m,
    {
        conn,
        botConfig,
        usedPrefix
    }
) {
    const emoji =
        typeof botConfig?.emoji === 'string' &&
        botConfig.emoji.trim()
            ? botConfig.emoji.trim()
            : '🍃'

    const prefix =
        typeof botConfig?.prefix === 'string'
            ? botConfig.prefix
            : (
                typeof usedPrefix === 'string'
                    ? usedPrefix
                    : ''
            )

    const mediaUrl =
        botConfig?.mediaUrl ||
        'https://files.catbox.moe/rdn7sk.jpg'

    const botName =
        botConfig?.name ||
        'jᥲdιbot'

    const previewUrl =
        'https://tewianix.org'

    const linkPreview =
        await createLinkPreview({
            conn,
            imageUrl:
                mediaUrl,
            spotifyUrl:
                previewUrl,
            title:
                botName,
            description:
                `Spotify ${emoji}`
        })

    const text =
        `${previewUrl}\n\n` +
        `*Uso incorrecto del comando.* ${emoji}\n\n` +
        `*Para descargar canciones ingresa*\n\n` +
        `*${prefix}spotify https://open.spotify.com/track/xxxxxx*`

    await conn.sendMessage(
        m.chat,
        {
            text,
            linkPreview
        },
        {
            quoted:
                m
        }
    )
}

export default {
    command: [
        'spotify'
    ],

    async run(
        m,
        {
            conn,
            args = [],
            text = '',
            usedPrefix = '',
            botConfig
        }
    ) {
        if (
            !conn?.isSubBot &&
            !conn?.isSubbot
        ) {
            return
        }

        let currentConfig =
            botConfig

        const subbotJid =
            conn?.subBotJid ||
            conn?.user?.jid ||
            conn?.user?.id ||
            ''

        if (subbotJid) {
            try {
                currentConfig =
                    getSubbotConfig(
                        subbotJid
                    )
            } catch (error) {
                console.error(
                    '[SPOTIFY] Error leyendo configuración:',
                    error
                )
            }
        }

        const query =
            String(
                text ||
                args.join(' ') ||
                ''
            ).trim()

        if (!query) {
            return sendJadibotHelp(
                m,
                {
                    conn,
                    botConfig:
                        currentConfig,
                    usedPrefix
                }
            )
        }

        const urlMatch =
            query.match(
                /https?:\/\/[^\s]+/i
            )

        const spotifyUrl =
            urlMatch?.[0] || ''

        const trackId =
            getSpotifyTrackId(
                spotifyUrl
            )

        if (!trackId) {
            const emoji =
                typeof currentConfig?.emoji === 'string' &&
                currentConfig.emoji.trim()
                    ? currentConfig.emoji.trim()
                    : '🍃'

            return m.reply(
                `*El enlace de Spotify no es válido.* ${emoji}\n\n` +
                `Ejemplo:\n` +
                `*${usedPrefix}spotify https://open.spotify.com/track/xxxxxx*`
            )
        }

        try {
            await m.react('🎵')
        } catch {}

        try {
            const track =
                await getSpotifyTrack(
                    trackId
                )

            const title =
                track?.name ||
                'Canción desconocida'

            const artists =
                Array.isArray(
                    track?.artists
                )
                    ? track.artists
                        .map(
                            artist =>
                                artist?.name
                        )
                        .filter(Boolean)
                        .join(', ')
                    : 'Artista desconocido'

            const cover =
                track?.album?.images?.[0]?.url ||
                track?.album?.images?.[1]?.url ||
                track?.album?.images?.[2]?.url ||
                null

            const originalSpotifyUrl =
                track?.external_urls?.spotify ||
                spotifyUrl

            const emoji =
                typeof currentConfig?.emoji === 'string' &&
                currentConfig.emoji.trim()
                    ? currentConfig.emoji.trim()
                    : '🍃'

            const linkPreview =
                await createLinkPreview({
                    conn,
                    imageUrl:
                        cover,
                    spotifyUrl:
                        originalSpotifyUrl,
                    title:
                        title,
                    description:
                        `${artists} ${emoji}`
                })

            const message =
                `${originalSpotifyUrl}\n\n` +
                `${emoji} *${title}*\n` +
                `${emoji} *${artists}*\n\n` +
                `DL SPOTIFY ${emoji}`

            await conn.sendMessage(
                m.chat,
                {
                    text:
                        message,
                    linkPreview
                },
                {
                    quoted:
                        m
                }
            )

            try {
                await m.react('✅')
            } catch {}

        } catch (error) {
            console.error(
                '[SPOTIFY] Error:',
                error
            )

            try {
                await m.react('❌')
            } catch {}

            const emoji =
                typeof currentConfig?.emoji === 'string' &&
                currentConfig.emoji.trim()
                    ? currentConfig.emoji.trim()
                    : '🍃'

            await m.reply(
                `*No se pudo descargar.* ${emoji}\n\n`
            )
        }
    }
}
