import {acceptHMRUpdate, defineStore} from 'pinia'
import {Edge, Node} from 'vis-network/peer'
import {useUserStore} from './userStore'
import {type ArtistDesc, type SimilarityDesc} from './types'
import {LastFm, Navidrome} from './services'

const splitName = (name: string): string[] => {
  const delimiters = [
    ', ',
    '&',
    '/',
    ' VS ',
    ' Vs ',
    ' ft ',
    ' f.',
    ' Ft ',
    ' ft.',
    ' Ft.',
    ' and ',
    ' And ',
    ' feat ',
    ' Feat ',
    ' Featuring ',
    ' feat.',
    ' Feat.',
  ]
  let output: string[] = [name]
  for (const del of delimiters) {
    let intermediate: string[] = []

    while (output.length > 0) {
      const name = output.splice(0)
      name[0].split(del).forEach((n) => intermediate.push(n))
    }

    output = intermediate
  }
  return output.map((s) => s.trim())
}

const getSimilarArtists = async (
  artist: string,
  limit: number = 25
): Promise<SimilarityDesc[]> => {
  try {
    const data = await LastFm.getSimilarArtists(
      artist,
      useUserStore().lastFmApiKey,
      limit
    )
    // TODO: add matching between exact names from Navidrome and corrected ones
    // from LastFM to avoid duplicates
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

export const useDataStore = defineStore('data', {
  state: () => {
    const similaritiesCache = new Map<string, SimilarityDesc[]>()

    const serializedData = localStorage.getItem('similarities')
    if (serializedData) {
      const data = JSON.parse(serializedData)
      data.forEach(([artist, similarities]: [string, SimilarityDesc[]]) => {
        similaritiesCache.set(artist, similarities)
      })
    }

    return {
      lastId: 0,
      artists: new Map<string, ArtistDesc>(),
      nodes: [] as Node[],
      edges: [] as Edge[],
      similarities: similaritiesCache,
      similaritiesQueue: [] as string[],
      similarityMatchThreshold: 0.85,
      showOrphans: false,
      enableCache: true,
    }
  },
  actions: {
    addSimilarArtists(artist: string, similarities: SimilarityDesc[]) {
      this.similarities.set(artist, similarities)
      if (this.enableCache) {
        const serializedData = JSON.stringify(Array.from(this.similarities))
        localStorage.setItem('similarities', serializedData)
      }
    },
    async requestNavidromeArtists() {
      this.artists = new Map<string, ArtistDesc>()
      this.lastId = 0

      const user = useUserStore()
      const data = await Navidrome.getArtists(
        user.navidromeInstance,
        user.login,
        user.password
      )
      const artistIdx = data['subsonic-response'].artists.index
      const artistArrays = artistIdx.map((el) => el.artist)

      for (const artistArray of artistArrays) {
        for (const artist of artistArray) {
          const names = splitName(artist.name)
          const albumsCount = artist.albumCount

          for (const name of names) {
            if (this.artists.has(name)) {
              this.artists.get(name)!.albumCount += albumsCount
            } else {
              this.artists.set(name, {
                id: this.lastId++,
                mbid: artist.musicBrainzId,
                albumCount: albumsCount,
              })
            }
          }
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
      const artistsLimit = this.artists.size > 1000 ? 10 : 25
      while (this.similaritiesQueue.length) {
        const artist = this.similaritiesQueue.shift()!

        if (!this.similarities.has(artist)) {
          this.addSimilarArtists(
            artist,
            await getSimilarArtists(artist, artistsLimit)
          )
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

        if (
          !this.showOrphans &&
          albumCount > 0 &&
          (!this.similarities.has(name) ||
            this.similarities.get(name)?.length == 0)
        ) {
          continue
        }

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
