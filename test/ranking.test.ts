import { describe, it, expect } from 'vitest'
import { rankSpots } from '../src/services/ranking.js'
import { scoreWeather } from '../src/services/weather.js'
import { haversineKm } from '../src/services/geo.js'
import { lightConditions } from '../src/services/astronomy.js'
import type { Spot, WeatherScore, LightConditions } from '../src/schemas.js'

const mockWeather: WeatherScore = {
  score: 75,
  temperatureCelsius: 18,
  cloudCoverPercent: 30,
  precipitationMm: 0,
  windSpeedKmh: 10,
  visibilityKm: 20,
  weatherCode: 1,
  weatherLabel: 'Überwiegend klar',
  fogProbability: 'niedrig',
  photoQualityLabel: 'Gut',
}

const mockLight: LightConditions = lightConditions('2026-06-23', 47.3, 8.5)

const spots: Spot[] = [
  { id: 'a', name: 'Nahes Viewpoint', lat: 47.31, lon: 8.51, distanceKm: 1.5, type: 'tourism=viewpoint', motivType: 'viewpoint' },
  { id: 'b', name: 'Ferner See', lat: 47.5, lon: 8.7, distanceKm: 25, type: 'natural=water', motivType: 'lake' },
  { id: 'c', name: 'Wasserfall', lat: 47.32, lon: 8.52, distanceKm: 3, type: 'natural=waterfall', motivType: 'waterfall' },
]

describe('rankSpots', () => {
  it('gibt maximal topN Spots zurück', () => {
    const ranked = rankSpots(spots, mockWeather, mockLight, 2)
    expect(ranked).toHaveLength(2)
  })

  it('sortiert nach Score absteigend', () => {
    const ranked = rankSpots(spots, mockWeather, mockLight, 10)
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score)
    }
  })

  it('alle Scores liegen im Bereich 0–100', () => {
    const ranked = rankSpots(spots, mockWeather, mockLight, 10)
    ranked.forEach(s => {
      expect(s.score).toBeGreaterThanOrEqual(0)
      expect(s.score).toBeLessThanOrEqual(100)
    })
  })
})

describe('scoreWeather', () => {
  it('klarer Himmel = hoher Score', () => {
    expect(scoreWeather(0, 0, 5, 30, 0)).toBeGreaterThan(80)
  })

  it('Gewitter = niedriger Score', () => {
    expect(scoreWeather(90, 15, 60, 1, 95)).toBeLessThan(30)
  })
})

describe('haversineKm', () => {
  it('Distanz Zürich–Bern ca. 95 km', () => {
    const dist = haversineKm(47.376, 8.541, 46.948, 7.448)
    expect(dist).toBeGreaterThan(90)
    expect(dist).toBeLessThan(100)
  })

  it('gleicher Punkt = 0 km', () => {
    expect(haversineKm(47, 8, 47, 8)).toBe(0)
  })
})
