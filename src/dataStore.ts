import {acceptHMRUpdate, defineStore} from 'pinia'
import {Edge, Node} from 'vis-network/peer'
import {useUserStore} from './userStore'

type LastFMApiResponse =
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

type ArtistsSubsonicResponse = {
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

type ArtistDesc = {
  id: number
  mbid: string
  albumCount: number
}

type SimilarityDesc = {
  artist: string
  mbid: string
  match: number
}

const getSimilarArtists = async (
  artist: string,
  mbid: string
): Promise<SimilarityDesc[]> => {
  const response = await fetch(
    new URL(
      `http://ws.audioscrobbler.com/2.0/?${new URLSearchParams({
        method: 'artist.getsimilar',
        artist,
        // TODO: try to use MBID if the artist is not found
        // mbid,
        autocorrect: '1',
        limit: '25',
        api_key: useUserStore().lastFmApiKey,
        format: 'json',
      })}`
    )
  )

  const data: LastFMApiResponse = await response.json()

  if ('error' in data) {
    console.error(data['message'])
    return []
  }

  const similarityIdx = data['similarartists']['artist'].map((artist) => {
    return {
      artist: artist.name,
      mbid: artist.mbid,
      match: artist.match,
    }
  })
  return similarityIdx
}

const loadSimilaritiesCache = () => {
  const similaritiesCache = new Map<string, SimilarityDesc[]>()

  const serializedData = localStorage.getItem('similarities')
  if (serializedData) {
    const data = JSON.parse(serializedData)
    data.forEach(([artist, similarities]: [string, SimilarityDesc[]]) => {
      similaritiesCache.set(artist, similarities)
    })
  }

  return similaritiesCache
}

const saveSimilaritiesCache = (similarities: Map<string, SimilarityDesc[]>) => {
  const serializedData = JSON.stringify(Array.from(similarities))
  localStorage.setItem('similarities', serializedData)
}

export const useDataStore = defineStore('data', {
  state: () => {
    return {
      lastId: 0,
      artists: new Map<string, ArtistDesc>(),
      nodes: [] as Node[],
      edges: [] as Edge[],
      similarities: loadSimilaritiesCache(),
      similaritiesQueue: [] as string[],
    }
  },
  actions: {
    addSimilarArtists(artist: string, similarities: SimilarityDesc[]) {
      this.similarities.set(artist, similarities)
      saveSimilaritiesCache(this.similarities)
    },
    async requestNavidromeArtists() {
      this.artists = new Map<string, ArtistDesc>()
      this.lastId = 0

      const user = useUserStore()
      const response = await fetch(
        `${user.navidromeApiBase}getArtists?${new URLSearchParams({
          u: user.login,
          c: 'Hoarder',
          v: '1.16.1',
          p: user.password,
          f: 'json',
        })}`
      )
      const data: ArtistsSubsonicResponse = await response.json()
      const artistIdx = data['subsonic-response'].artists.index
      const artistArrays = artistIdx.map((el) => el.artist)

      for (const artistArray of artistArrays) {
        for (const artist of artistArray) {
          const name = artist.name
          const albumsCount = artist.albumCount
          this.artists.set(name, {
            id: this.lastId++,
            mbid: artist.musicBrainzId,
            albumCount: albumsCount,
          })
        }
      }
    },
    buildGraph() {
      this.nodes = []
      for (const data of this.artists.entries()) {
        const name = data[0]
        const albumCount = data[1].albumCount
        this.nodes.push({
          id: data[1].id,
          label: name,
          color:
            albumCount > 0
              ? albumCount > 2
                ? '#539cfc'
                : '#d4e6fc'
              : '#f5f5f5',
          // value: albumCount,
        })
      }

      this.edges = []
      for (const data of this.similarities.entries()) {
        const fromName = data[0]
        if (!this.artists.has(fromName)) {
          console.error('Artist not found')
          continue
        }

        const fromId = this.artists.get(fromName)!.id
        for (const similarity of data[1]) {
          const toName = similarity.artist
          if (!this.artists.has(toName)) {
            continue
          }

          const toId = this.artists.get(toName)!.id
          this.edges.push({
            from: fromId,
            to: toId,
            // value: similarity[1].match,
          })
        }
      }
    },
    async requestAllData() {
      // step 1: get all existing artists
      await this.requestNavidromeArtists()

      // step 2: find similar artists
      let i = 0
      for (const artist of new Map(this.artists)) {
        if (i++ > 10) {
          break
        }

        const name = artist[0]

        if (!this.similarities.has(name)) {
          this.addSimilarArtists(
            name,
            await getSimilarArtists(name, artist[1].mbid)
          )
        }

        const similarities = this.similarities.get(name)!
        for (const similarity of similarities) {
          if (similarity.match < 0.65) continue
          if (!this.artists.has(similarity.artist)) {
            this.artists.set(similarity.artist, {
              id: this.lastId++,
              mbid: similarity.mbid,
              albumCount: 0,
            })
          }
        }
      }

      // step 3: build graph
      this.buildGraph()
    },
  },
  getters: {
    loading: (state) => state.similaritiesQueue.length > 0,
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDataStore, import.meta.hot))
}
