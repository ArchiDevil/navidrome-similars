import {acceptHMRUpdate, defineStore} from 'pinia'
import {Edge, Node} from 'vis-network/peer'
import {useUserStore} from './userStore'
import {
  type ArtistDesc,
  type ArtistsSubsonicResponse,
  type LastFMApiResponse,
  type SimilarityDesc,
} from './types'

const getSimilarArtists = async (artist: string): Promise<SimilarityDesc[]> => {
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
    console.error(data.message)
    return []
  }

  const similarityIdx = data.similarartists.artist.map((artist) => {
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
      similarityMatchThreshold: 0.85,
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
    async findSimilarArtists() {
      // fill the queue
      for (const artist of new Map(this.artists)) {
        const name = artist[0]
        this.similaritiesQueue.push(name)
      }

      // process the queue
      while (this.similaritiesQueue.length) {
        const artist = this.similaritiesQueue.shift()!

        if (!this.similarities.has(artist)) {
          this.addSimilarArtists(artist, await getSimilarArtists(artist))
          await new Promise((resolve) => setTimeout(resolve, 50))
        }

        const similarities = this.similarities.get(artist)!
        for (const similarity of similarities) {
          if (similarity.match < this.similarityMatchThreshold) continue
          if (!this.artists.has(similarity.artist)) {
            this.artists.set(similarity.artist, {
              id: this.lastId++,
              mbid: similarity.mbid,
              albumCount: 0,
            })
          }
        }
      }
    },
    buildGraph() {
      this.nodes = []
      this.edges = []

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
      await this.requestNavidromeArtists()
      await this.findSimilarArtists()
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
