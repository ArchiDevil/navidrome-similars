export namespace Navidrome {
  type SubsonicApiResponse = {
    'subsonic-response': {
      version: string
      type: string // navidrome
      serverVersion: string
      openSubsonic: boolean
    }
  }

  export type ApiError = {
    'subsonic-response': SubsonicApiResponse['subsonic-response'] & {
      status: 'failed'
      error: {
        code: number
        message: string
      }
    }
  }

  export type ArtistsDesc = {
    'subsonic-response': SubsonicApiResponse['subsonic-response'] & {
      status: 'ok'
      artists: {
        index: {
          name: string
          artist: {
            id: string
            name: string
            coverArt: string
            albumCount: number
            artistImageUrl: string
            musicBrainzId: string
            sortName: string
            roles: string[]
          }[]
        }[]
        lastModified: number
        ignoredArticles: string
      }
    }
  }

  const isApiError = (data: ApiError | ArtistsDesc): data is ApiError => {
    return data['subsonic-response'].status === 'failed'
  }

  export const getArtists = async (
    apiBase: string,
    login: string,
    password: string
  ): Promise<ArtistsDesc> => {
    const response = await fetch(
      `${apiBase}getArtists?${new URLSearchParams({
        u: login,
        c: 'Hoarder',
        v: '1.16.1',
        p: password,
        f: 'json',
      })}`
    )
    const data: ArtistsDesc | ApiError = await response.json()

    if (isApiError(data)) {
      throw new Error(data['subsonic-response'].error.message)
    }

    return data
  }
}

export namespace LastFm {
  export type ApiError = {
    error: number
    message: string
  }

  export type SimilarArtists = {
    similarartists: {
      artist: {
        name: string
        mbid: string
        match: number
      }[]
    }
  }

  export const getSimilarArtists = async (
    artist: string,
    apiKey: string
  ): Promise<SimilarArtists> => {
    const response = await fetch(
      new URL(
        `http://ws.audioscrobbler.com/2.0/?${new URLSearchParams({
          method: 'artist.getsimilar',
          artist,
          // TODO: try to use MBID if the artist is not found
          // mbid,
          autocorrect: '1',
          limit: '25',
          api_key: apiKey,
          format: 'json',
        })}`
      )
    )

    const data: ApiError | SimilarArtists = await response.json()

    if ('error' in data) {
      throw new Error(data.message)
    }

    return data
  }
}
