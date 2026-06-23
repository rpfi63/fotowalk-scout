import { fetchWithRetry } from '../lib/http.js'
import type { WeatherScore } from '../schemas.js'

/** WMO-Wettercodes → sprechende Bezeichnungen */
function weatherLabel(code: number): string {
  if (code === 0) return 'Klarer Himmel'
  if (code <= 2) return 'Überwiegend klar'
  if (code === 3) return 'Bedeckt'
  if (code <= 49) return 'Nebel'
  if (code <= 59) return 'Nieselregen'
  if (code <= 69) return 'Regen'
  if (code <= 79) return 'Schnee'
  if (code <= 82) return 'Regenschauer'
  if (code <= 86) return 'Schneeschauer'
  if (code <= 99) return 'Gewitter'
  return 'Unbekannt'
}

/** Fotografische Qualitätsbeschriftung basierend auf Score */
function photoQualityLabel(score: number): string {
  if (score >= 80) return 'Ausgezeichnet — ideale Bedingungen'
  if (score >= 60) return 'Gut — brauchbare Bedingungen'
  if (score >= 40) return 'Befriedigend — eingeschränkte Bedingungen'
  if (score >= 20) return 'Schlecht — schwierige Bedingungen'
  return 'Sehr schlecht — Fotografie nicht empfohlen'
}

/**
 * Nebel-Wahrscheinlichkeit ableiten:
 * WMO-Codes 45/48 = Nebel direkt. Zusätzlich: hohe Luftfeuchte + geringe Wind.
 */
function fogProbability(
  code: number,
  relativeHumidity: number,
  windSpeedKmh: number,
  visibilityKm: number
): 'niedrig' | 'mittel' | 'hoch' {
  if (code === 45 || code === 48) return 'hoch'
  if (visibilityKm < 2) return 'hoch'
  if (relativeHumidity > 90 && windSpeedKmh < 10) return 'mittel'
  if (relativeHumidity > 80 && windSpeedKmh < 5) return 'mittel'
  return 'niedrig'
}

/**
 * Fotografischer Score 0–100 aus Wetterdaten.
 * Faktoren: Wolken (negativ außer teils bewölkt), Regen (stark negativ),
 * Wind (moderat negativ), Sichtweite (positiv), Nebel (positiv für Stimmung).
 */
export function scoreWeather(
  cloudCover: number,
  precipitation: number,
  windSpeed: number,
  visibilityKm: number,
  weatherCode: number,
): number {
  let score = 100

  // Wolkenbedeckung: leicht bewölkt ist gut für weiche Schatten
  if (cloudCover <= 20) score -= 0           // klarer Himmel — gut
  else if (cloudCover <= 50) score -= 5      // teils bewölkt — sehr gut für Fotografie
  else if (cloudCover <= 75) score -= 20     // stark bewölkt
  else score -= 35                            // bedeckt

  // Niederschlag
  if (precipitation > 10) score -= 40
  else if (precipitation > 2) score -= 25
  else if (precipitation > 0.5) score -= 10

  // Wind
  if (windSpeed > 50) score -= 20
  else if (windSpeed > 30) score -= 10
  else if (windSpeed > 20) score -= 5

  // Sichtweite
  if (visibilityKm < 1) score -= 30
  else if (visibilityKm < 5) score -= 15
  else if (visibilityKm < 10) score -= 5

  // Gewitter — immer schlecht
  if (weatherCode >= 95) score -= 30

  // Nebel leicht positiv (Stimmung), aber nur wenn kein Regen
  if ((weatherCode === 45 || weatherCode === 48) && precipitation < 0.5) score += 5

  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Holt Wetterdaten von Open-Meteo und berechnet Foto-Score.
 * Verwendet stündliche Daten für den angegebenen Tag.
 */
export async function fetchAndScore(dateStr: string, lat: number, lon: number): Promise<WeatherScore> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('hourly', 'temperature_2m,relativehumidity_2m,precipitation,weathercode,cloudcover,windspeed_10m,visibility')
  url.searchParams.set('daily', 'precipitation_sum')
  url.searchParams.set('start_date', dateStr)
  url.searchParams.set('end_date', dateStr)
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('wind_speed_unit', 'kmh')

  const res = await fetchWithRetry(url.toString())
  if (!res.ok) {
    throw new Error(`Open-Meteo Fehler: ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as {
    hourly: {
      time: string[]
      temperature_2m: number[]
      relativehumidity_2m: number[]
      precipitation: number[]
      weathercode: number[]
      cloudcover: number[]
      windspeed_10m: number[]
      visibility: number[]
    }
  }

  // Mittagswert (12:00) als Referenz für den Tag
  const noonIdx = data.hourly.time.findIndex(t => t.includes('T12:00'))
  const idx = noonIdx >= 0 ? noonIdx : 0

  const cloudCover = data.hourly.cloudcover[idx] ?? 50
  const precipitation = data.hourly.precipitation[idx] ?? 0
  const windSpeed = data.hourly.windspeed_10m[idx] ?? 0
  const visibilityM = data.hourly.visibility[idx] ?? 10_000
  const visibilityKm = visibilityM / 1000
  const weatherCode = data.hourly.weathercode[idx] ?? 0
  const temperature = data.hourly.temperature_2m[idx] ?? 15
  const humidity = data.hourly.relativehumidity_2m[idx] ?? 60

  const score = scoreWeather(cloudCover, precipitation, windSpeed, visibilityKm, weatherCode)
  const fog = fogProbability(weatherCode, humidity, windSpeed, visibilityKm)

  return {
    score,
    temperatureCelsius: Math.round(temperature * 10) / 10,
    cloudCoverPercent: cloudCover,
    precipitationMm: precipitation,
    windSpeedKmh: windSpeed,
    visibilityKm: Math.round(visibilityKm * 10) / 10,
    weatherCode,
    weatherLabel: weatherLabel(weatherCode),
    fogProbability: fog,
    photoQualityLabel: photoQualityLabel(score),
  }
}
