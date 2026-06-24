import type { Spot, WeatherScore, LightConditions, RankedSpot } from '../schemas.js'

/** Bonus-Punkte pro POI-Typ — Viewpoints & Wasserfälle fotografisch hochwertiger */
const TYPE_BONUS: Record<string, number> = {
  'tourism=viewpoint':  20,
  'waterway=waterfall': 18,
  'natural=peak':       15,
  'natural=water':      12,
  'waterway=river':     10,
  'historic=castle':    10,
  'natural=wood':        5,
}

/**
 * Berechnet Gesamtscore 0–100 für einen Spot.
 *
 * Gewichtung:
 * - Wetter-Score:     40 %
 * - POI-Typ-Bonus:    20 %
 * - Distanz (näher besser): 25 %
 * - Höhe (bei Berggipfeln):  15 %
 */
function scoreSpot(spot: Spot, weather: WeatherScore, maxDistKm: number): number {
  // Wetter (0–100 → 0–40)
  const weatherComponent = weather.score * 0.4

  // POI-Typ (0–20)
  const typeComponent = TYPE_BONUS[spot.type] ?? 5

  // Distanz: 0 km → 25 Punkte, maxDist → 0 Punkte (skaliert auf tatsächlichen Radius)
  const distancePenalty = Math.min(spot.distanceKm / maxDistKm, 1)
  const distanceComponent = 25 * (1 - distancePenalty)

  // Höhe: Gipfel über 500m bekommen Bonus (max. 15 Punkte bei 2000m+)
  let elevationComponent = 0
  if (spot.elevationM != null && spot.motivType === 'mountain') {
    elevationComponent = Math.min((spot.elevationM / 2000) * 15, 15)
  }

  const raw = weatherComponent + typeComponent + distanceComponent + elevationComponent
  return Math.max(0, Math.min(100, Math.round(raw)))
}

/**
 * Bewertet und sortiert eine Liste von Spots.
 * Garantiert mindestens einen Vertreter pro Motivtyp, Rest nach Score.
 */
export function rankSpots(
  spots: Spot[],
  weather: WeatherScore,
  _light: LightConditions,
  topN = 10,
): RankedSpot[] {
  const maxDistKm = spots.length > 0 ? Math.max(...spots.map(s => s.distanceKm)) : 30
  const ranked = spots.map(spot => ({
    ...spot,
    score: scoreSpot(spot, weather, maxDistKm),
    tips: null,
  })).sort((a, b) => b.score - a.score)

  // Besten Spot pro Motivtyp sicherstellen
  const seen = new Set<string>()
  const guaranteed: RankedSpot[] = []
  for (const spot of ranked) {
    if (!seen.has(spot.motivType)) {
      guaranteed.push(spot)
      seen.add(spot.motivType)
    }
  }

  // Rest auffüllen (ohne bereits gewählte Spots)
  const guaranteedIds = new Set(guaranteed.map(s => s.id))
  const rest = ranked.filter(s => !guaranteedIds.has(s.id))
  const combined = [...guaranteed, ...rest]

  return combined.slice(0, Math.min(topN, combined.length))
}
