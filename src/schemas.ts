import { z } from 'zod'

// ── Motivtypen → OSM-Tags ────────────────────────────────────────────────────
export const MOTIV_TYPES = ['lake', 'mountain', 'waterfall', 'castle', 'forest', 'viewpoint', 'river'] as const
export type MotivType = typeof MOTIV_TYPES[number]

// ── Request ──────────────────────────────────────────────────────────────────
export const PlanRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timeOfDay: z.enum(['sunrise', 'morning', 'noon', 'afternoon', 'sunset', 'night']).optional(),
  startLocation: z.string().min(2),
  radiusKm: z.number().min(1).max(200),
  motivTypes: z.array(z.enum(MOTIV_TYPES)).min(1),
})
export type PlanRequest = z.infer<typeof PlanRequestSchema>

// ── Wetter ───────────────────────────────────────────────────────────────────
export const WeatherScoreSchema = z.object({
  score: z.number().min(0).max(100),
  temperatureCelsius: z.number(),
  cloudCoverPercent: z.number(),
  precipitationMm: z.number(),
  windSpeedKmh: z.number(),
  visibilityKm: z.number(),
  weatherCode: z.number(),
  weatherLabel: z.string(),
  fogProbability: z.enum(['niedrig', 'mittel', 'hoch']),
  photoQualityLabel: z.string(),
})
export type WeatherScore = z.infer<typeof WeatherScoreSchema>

// ── Lichtbedingungen ─────────────────────────────────────────────────────────
export const LightConditionsSchema = z.object({
  sunrise: z.string(),
  sunset: z.string(),
  goldenHourMorning: z.object({ start: z.string(), end: z.string() }),
  goldenHourEvening: z.object({ start: z.string(), end: z.string() }),
  blueHourMorning: z.object({ start: z.string(), end: z.string() }),
  blueHourEvening: z.object({ start: z.string(), end: z.string() }),
  moonPhase: z.number().min(0).max(1),
  moonPhaseLabel: z.string(),
  sunAzimuthAtSunrise: z.number(),
  sunAzimuthAtSunset: z.number(),
})
export type LightConditions = z.infer<typeof LightConditionsSchema>

// ── Foto-Spot ─────────────────────────────────────────────────────────────────
export const SpotSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  distanceKm: z.number(),
  type: z.string(),
  motivType: z.string(),
  elevationM: z.number().optional(),
  score: z.number().min(0).max(100).optional(),
})
export type Spot = z.infer<typeof SpotSchema>

// ── Foto-Tipps (KI-Output) ───────────────────────────────────────────────────
export const PhotoTipsSchema = z.object({
  description: z.string(),
  whySuitable: z.string(),
  focalLengths: z.array(z.string()),
  filters: z.array(z.string()),
  compositionIdeas: z.array(z.string()),
  weatherHints: z.string(),
})
export type PhotoTips = z.infer<typeof PhotoTipsSchema>

// ── Spot mit Score + Tipps ───────────────────────────────────────────────────
export const RankedSpotSchema = SpotSchema.extend({
  score: z.number().min(0).max(100),
  tips: PhotoTipsSchema.nullable(),
})
export type RankedSpot = z.infer<typeof RankedSpotSchema>

// ── Geocode-Ergebnis ─────────────────────────────────────────────────────────
export const LocationSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  displayName: z.string(),
})
export type Location = z.infer<typeof LocationSchema>

// ── Response ─────────────────────────────────────────────────────────────────
export const PlanResponseSchema = z.object({
  location: LocationSchema,
  date: z.string(),
  weather: WeatherScoreSchema,
  light: LightConditionsSchema,
  spots: z.array(RankedSpotSchema),
  tipsGenerated: z.boolean(),
  processingMs: z.number(),
})
export type PlanResponse = z.infer<typeof PlanResponseSchema>
