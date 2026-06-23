import SunCalc from 'suncalc'
import type { LightConditions } from '../schemas.js'

/** Formatiert ein Date-Objekt als HH:MM (lokale Zeit) */
function fmt(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

/** Mondphasen-Beschriftung (0 = Neumond, 0.5 = Vollmond) */
function moonPhaseLabel(phase: number): string {
  if (phase < 0.063) return 'Neumond'
  if (phase < 0.188) return 'Zunehmende Sichel'
  if (phase < 0.313) return 'Erstes Viertel'
  if (phase < 0.438) return 'Zunehmender Gibbous'
  if (phase < 0.563) return 'Vollmond'
  if (phase < 0.688) return 'Abnehmender Gibbous'
  if (phase < 0.813) return 'Letztes Viertel'
  if (phase < 0.938) return 'Abnehmende Sichel'
  return 'Neumond'
}

/**
 * Berechnet alle fotografisch relevanten Lichtereignisse
 * für einen gegebenen Tag und Standort.
 */
export function lightConditions(dateStr: string, lat: number, lon: number): LightConditions {
  const date = new Date(dateStr + 'T12:00:00Z')

  const times = SunCalc.getTimes(date, lat, lon)
  const sunrisePos = SunCalc.getPosition(times.sunrise, lat, lon)
  const sunsetPos = SunCalc.getPosition(times.sunset, lat, lon)
  const moonIllum = SunCalc.getMoonIllumination(date)

  // Azimut: SunCalc gibt Werte in Bogenmaß (-π bis π), Norden = 0
  const azimuthDeg = (rad: number) => ((rad * 180) / Math.PI + 360) % 360

  // Golden Hour: ca. 1h nach Sunrise / 1h vor Sunset
  const goldenMorningStart = times.sunrise
  const goldenMorningEnd = times.goldenHourEnd
  const goldenEveningStart = times.goldenHour
  const goldenEveningEnd = times.sunset

  // Blue Hour: ca. 20–40 min vor Sunrise / nach Sunset
  const blueMorningStart = times.nauticalDawn
  const blueMorningEnd = times.dawn
  const blueEveningStart = times.dusk
  const blueEveningEnd = times.nauticalDusk

  const phase = moonIllum.phase

  return {
    sunrise: fmt(times.sunrise),
    sunset: fmt(times.sunset),
    goldenHourMorning: { start: fmt(goldenMorningStart), end: fmt(goldenMorningEnd) },
    goldenHourEvening: { start: fmt(goldenEveningStart), end: fmt(goldenEveningEnd) },
    blueHourMorning: { start: fmt(blueMorningStart), end: fmt(blueMorningEnd) },
    blueHourEvening: { start: fmt(blueEveningStart), end: fmt(blueEveningEnd) },
    moonPhase: phase,
    moonPhaseLabel: moonPhaseLabel(phase),
    sunAzimuthAtSunrise: Math.round(azimuthDeg(sunrisePos.azimuth)),
    sunAzimuthAtSunset: Math.round(azimuthDeg(sunsetPos.azimuth)),
  }
}
