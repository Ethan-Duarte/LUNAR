/** Public factual mission record used by LUNAR education. No showcase renderer. */
export interface Mission {
  id: string
  name: string
  agency: string
  country: string
  date_utc: string
  lat: number
  lon: number
  status: 'landed' | 'crashed' | 'planned' | 'candidate'
  kind: 'crewed' | 'robotic'
  summary: string
  source_url: string
  about?: string
  facts?: [label: string, value: string][]
  image?: { file: string; caption?: string; credit?: string; license?: string; source_url?: string }
  model?:
    | { kind: 'glb'; file: string; height_m: number; credit?: string; license?: string; source_url?: string }
    | { kind: 'archetype'; archetype: string; height_m: number; height_estimated?: boolean }
}
