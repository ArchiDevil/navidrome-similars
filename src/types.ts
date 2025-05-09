export type LastFMApiResponse =
  | {
      error: number
      message: string
    }
  | {
      similarartists: {
        artist: {
          name: string
          mbid: string
          match: number
        }[]
      }
    }

export type ArtistsSubsonicResponse = {
  'subsonic-response': {
    status: string
    version: string
    type: string
    serverVersion: string
    openSubsonic: boolean
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

export type ArtistDesc = {
  id: number
  mbid: string
  albumCount: number
}

export type SimilarityDesc = {
  artist: string
  mbid: string
  match: number
}
