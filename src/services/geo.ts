import { fetchWithRetry } from '../lib/http.js'
import { cfg } from '../config.js'
import type { Location, MotivType, Spot } from '../schemas.js'

/** OSM-Tags pro Motivtyp */
const MOTIV_TO_OSM: Record<MotivType, string> = {
  lake:      'natural=water',
  mountain:  'natural=peak',
  waterfall: 'waterway=waterfall',
  castle:    'historic=castle',
  forest:    'natural=wood',
  viewpoint: 'tourism=viewpoint',
  river:     'waterway=river',
}

/** Zusätzliche OSM-Tag-Filter pro Motivtyp (key=value) */
const MOTIV_EXTRA_FILTER: Partial<Record<MotivType, string>> = {
  lake: 'water=lake',
}

/** Haversine-Distanz in km */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Geocodiert einen Ortsname via Nominatim */
export async function geocode(query: string): Promise<Location> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')

  const res = await fetchWithRetry(url.toString())
  if (!res.ok) throw new Error(`Nominatim Fehler: ${res.status}`)

  const data = await res.json() as Array<{
    lat: string; lon: string; display_name: string; name?: string
  }>
  if (!data.length) throw new Error(`Ort nicht gefunden: ${query}`)

  const [first] = data
  return {
    name: query,
    lat: parseFloat(first.lat),
    lon: parseFloat(first.lon),
    displayName: first.display_name,
  }
}

/** Baut Overpass-QL für mehrere Motivtypen in einem Radius */
function buildOverpassQuery(lat: number, lon: number, radiusM: number, motivTypes: MotivType[]): string {
  const parts = motivTypes.map(mt => {
    const [key, value] = MOTIV_TO_OSM[mt].split('=')
    const extra = MOTIV_EXTRA_FILTER[mt] ? `["${MOTIV_EXTRA_FILTER[mt].split('=')[0]}"="${MOTIV_EXTRA_FILTER[mt].split('=')[1]}"]` : ''
    return `
  node["${key}"="${value}"]${extra}(around:${radiusM},${lat},${lon});
  way["${key}"="${value}"]${extra}(around:${radiusM},${lat},${lon});
  relation["${key}"="${value}"]${extra}(around:${radiusM},${lat},${lon});`
  })
  return `[out:json][timeout:25];
(${parts.join('')}
);
out center tags;`
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

const OVERPASS_MIRRORS = [
  cfg.overpassUrl,
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

/** Führt eine einzelne Overpass-Abfrage aus — bei 429 automatisch Mirror-Fallback */
async function queryOverpass(query: string, motivType: MotivType): Promise<Spot[]> {
  let lastError: Error | null = null

  for (const url of OVERPASS_MIRRORS) {
    let res: Response
    try {
      res = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        timeoutMs: 15_000,
        retries: 0,
      })
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      continue
    }

    if (res.status === 429 || res.status === 503 || res.status === 504) {
      lastError = new Error(`${res.status} auf ${url}`)
      continue
    }

    if (!res.ok) {
      throw Object.assign(new Error(`Overpass API Fehler: ${res.status}`), { statusCode: 502 })
    }

    const data = await res.json() as { elements: OverpassElement[] }
    const spots: Spot[] = []
    let idCounter = 0

    for (const el of data.elements) {
      const elLat = el.lat ?? el.center?.lat
      const elLon = el.lon ?? el.center?.lon
      if (elLat == null || elLon == null) continue

      const name = el.tags?.name ?? el.tags?.['name:de'] ?? 'Unbenannt'
      spots.push({
        id: `${el.type}-${el.id}-${idCounter++}-${motivType}`,
        name,
        lat: elLat,
        lon: elLon,
        distanceKm: 0,
        type: MOTIV_TO_OSM[motivType],
        motivType,
        elevationM: el.tags?.ele ? parseFloat(el.tags.ele) : undefined,
      })
    }

    return spots
  }

  throw Object.assign(lastError ?? new Error('Alle Overpass-Server nicht erreichbar'), { statusCode: 502 })
}

/** Sucht Foto-Spots via Overpass API — pro Motivtyp getrennt, damit jeder Typ vertreten ist */
export async function findSpots(
  lat: number,
  lon: number,
  radiusKm: number,
  motivTypes: MotivType[],
): Promise<Spot[]> {
  const radiusM = radiusKm * 1000
  const perType = Math.max(1, Math.floor(50 / motivTypes.length))

  // Alle Motivtypen parallel abfragen
  const results = await Promise.all(
    motivTypes.map(mt => {
      const query = buildOverpassQuery(lat, lon, radiusM, [mt])
      return queryOverpass(query, mt)
    })
  )

  // Pro Typ: Distanz berechnen, deduplizieren (gleicher Name + ~500m), top N nehmen
  const combined: Spot[] = []
  for (const spots of results) {
    const withDist = spots
      .map(s => ({ ...s, distanceKm: Math.round(haversineKm(lat, lon, s.lat, s.lon) * 10) / 10 }))
      .sort((a, b) => a.distanceKm - b.distanceKm)

    // Duplikate entfernen: gleicher Name = Duplikat (nur nächsten behalten)
    // Bei "Unbenannt": Proximity-Check (< 0.5 km)
    const deduped: typeof withDist = []
    for (const spot of withDist) {
      const isDup = spot.name === 'Unbenannt'
        ? deduped.some(s => s.name === 'Unbenannt' && haversineKm(s.lat, s.lon, spot.lat, spot.lon) < 0.5)
        : deduped.some(s => s.name === spot.name)
      if (!isDup) deduped.push(spot)
    }

    combined.push(...deduped.slice(0, perType))
  }

  return combined.sort((a, b) => a.distanceKm - b.distanceKm)
}
