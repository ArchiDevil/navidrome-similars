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
