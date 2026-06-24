import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { cfg } from '../config.js'
import type { RankedSpot, WeatherScore, LightConditions, PhotoTips } from '../schemas.js'

const anthropic = createAnthropic({ apiKey: cfg.anthropicApiKey })

const TipsOutputSchema = z.object({
  description: z.string(),
  whySuitable: z.string(),
  focalLengths: z.array(z.string()),
  filters: z.array(z.string()),
  compositionIdeas: z.array(z.string()),
  weatherHints: z.string(),
})

/** Generiert AI-Foto-Tipps für einen einzelnen Spot */
async function generateTipsForSpot(
  spot: RankedSpot,
  weather: WeatherScore,
  light: LightConditions,
  date: string,
): Promise<PhotoTips> {
  const prompt = `Du bist ein erfahrener Landschaftsfotograf. Gib konkrete Foto-Tipps für diesen Spot:

Spot: ${spot.name} (${spot.motivType}, ${spot.distanceKm} km entfernt)
Koordinaten: ${spot.lat.toFixed(4)}, ${spot.lon.toFixed(4)}
${spot.elevationM != null ? `Höhe: ${spot.elevationM} m` : ''}

Datum: ${date}
Wetter: ${weather.weatherLabel}, ${weather.temperatureCelsius}°C
Wolken: ${weather.cloudCoverPercent}%, Niederschlag: ${weather.precipitationMm} mm
Sichtweite: ${weather.visibilityKm} km, Nebel: ${weather.fogProbability}
Foto-Qualität: ${weather.photoQualityLabel}

Sonnenaufgang: ${light.sunrise}, Sonnenuntergang: ${light.sunset}
Goldene Stunde morgens: ${light.goldenHourMorning.start}–${light.goldenHourMorning.end}
Goldene Stunde abends: ${light.goldenHourEvening.start}–${light.goldenHourEvening.end}
Blaue Stunde morgens: ${light.blueHourMorning.start}–${light.blueHourMorning.end}
Blaue Stunde abends: ${light.blueHourEvening.start}–${light.blueHourEvening.end}
Mond: ${light.moonPhaseLabel}

Antworte mit präzisen, actionablen Empfehlungen auf Deutsch.`

  const { object } = await generateObject({
    model: anthropic(cfg.anthropicModel),
    schema: TipsOutputSchema,
    prompt,
  })

  return object
}

/**
 * Generiert AI-Tipps für die Top-Spots (max. 5 um API-Kosten zu begrenzen).
 * Bei Fehler wird tips = null gesetzt, Rest läuft weiter.
 */
export async function enrichWithTips(
  spots: RankedSpot[],
  weather: WeatherScore,
  light: LightConditions,
  date: string,
): Promise<{ spots: RankedSpot[]; tipsGenerated: boolean; tipError?: string }> {
  if (!cfg.anthropicApiKey) {
    return { spots, tipsGenerated: false, tipError: 'no-api-key' }
  }

  const topN = Math.min(spots.length, 3)
  const enriched = [...spots]

  // Top-Spots parallel bereichern
  const results = await Promise.allSettled(
    enriched.slice(0, topN).map(spot => generateTipsForSpot(spot, weather, light, date))
  )

  let anySuccess = false
  let lastError: string | undefined
  for (let i = 0; i < topN; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      enriched[i] = { ...enriched[i], tips: result.value }
      anySuccess = true
    } else {
      console.error(`Tips error spot ${i}:`, result.reason?.message, result.reason?.cause)
      lastError = String(result.reason?.message ?? result.reason)
    }
  }

  return { spots: enriched, tipsGenerated: anySuccess, tipError: lastError }
}
