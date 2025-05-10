import {acceptHMRUpdate, defineStore} from 'pinia'
import {Edge, Node} from 'vis-network/peer'
import {useUserStore} from './userStore'
import {type ArtistDesc, type SimilarityDesc} from './types'
import {LastFm, Navidrome} from './services'

const getSimilarArtists = async (artist: string): Promise<SimilarityDesc[]> => {
  try {
    const data = await LastFm.getSimilarArtists(
      artist,
      useUserStore().lastFmApiKey
    )
    const similarityIdx = data.similarartists.artist.map((artist) => {
      return {
        artist: artist.name,
        mbid: artist.mbid,
        match: artist.match,
      }
    })
    return similarityIdx
  } catch (e) {
    console.log(e)
    return []
  }
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
      const data = await Navidrome.getArtists(
        user.navidromeApiBase,
        user.login,
        user.password
      )
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
      const getColor = (albumCount: number) => {
        if (albumCount > 4) return '#8ACEF4'
        if (albumCount == 4) return '#A2D8F6'
        if (albumCount == 3) return '#B9E2F9'
        if (albumCount == 2) return '#D0EBFB'
        if (albumCount == 1) return '#E8F5FD'
        else return '#F5F5F5'
      }

      this.nodes = []
      this.edges = []

      for (const data of this.artists.entries()) {
        const name = data[0]
        const albumCount = data[1].albumCount
        this.nodes.push({
          id: data[1].id,
          label: name,
          color: getColor(albumCount),
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
          if (similarity.match < this.similarityMatchThreshold) continue

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
