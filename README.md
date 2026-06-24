# Fotowalk Scout

AI-gestützte Web-App zur Planung von Fotowalks. Findet Foto-Spots im gewählten Umkreis und bewertet sie anhand von Wetter, Licht und Motivtyp — inklusive AI-Tipps für die besten Standorte.

**Live:** https://fotowalk-scout.vercel.app

## Features

- Geocoding des Startorts via Nominatim (OpenStreetMap)
- Wetteranalyse und -bewertung via Open-Meteo API
- Astronomische Lichtberechnung (Sonnenaufgang, goldene Stunde, blaue Stunde, Mondphase)
- Spot-Suche via Overpass API (OSM) mit automatischem Mirror-Fallback
- Deduplizierung: gleiche Namen werden nur einmal angezeigt
- Ranking nach Wetter, POI-Typ, Distanz und Höhe
- AI-Fotografie-Tipps für die Top-3 Spots (Claude API)
- Leaflet-Karte mit Routenplaner (Fussroute)
- Export zu Google Maps und Apple Maps (jeweils Fuss-Modus)

## Motivtypen

`lake` · `mountain` · `waterfall` · `castle` · `forest` · `viewpoint` · `river`

## Architektur

```
public/index.html         # Frontend (Vanilla JS, Leaflet)
api/handler.ts            # Vercel Serverless Function
src/
  config.ts               # Konfiguration aus Env-Vars
  schemas.ts              # Zod-Schemas (Request / Response)
  server.ts               # Lokaler Fastify-Dev-Server
  services/
    geo.ts                # Geocoding + Overpass Spot-Suche + Deduplizierung
    weather.ts            # Open-Meteo Wetterdaten + Scoring
    astronomy.ts          # Lichtbedingungen (SunCalc)
    ranking.ts            # Spot-Ranking
    tips.ts               # AI-Tipps via Claude API (Top-3 Spots)
  lib/
    http.ts               # Fetch-Wrapper mit Retry-Logik
```

## API

### `POST /api/plan`

```json
{
  "date": "2026-06-25",
  "startLocation": "Zürich",
  "radiusKm": 20,
  "motivTypes": ["lake", "viewpoint"]
}
```

Gibt zurück: Standort, Wetterbewertung, Lichtbedingungen, bis zu 10 Spots (dedupliziert, gerankt), AI-Tipps für Top-3.

### `GET /api/health`

```json
{ "status": "ok", "ts": "2026-06-24T10:00:00.000Z" }
```

## Umgebungsvariablen

| Variable               | Beschreibung                                        | Pflicht |
|------------------------|-----------------------------------------------------|---------|
| `ANTHROPIC_API_KEY`    | API-Key für Claude (AI-Tipps)                       | Ja      |
| `ANTHROPIC_MODEL`      | Claude-Modell (Standard: `claude-sonnet-4-6`)       | Nein    |
| `OVERPASS_URL`         | Overpass-API-Endpunkt                               | Nein    |
| `NOMINATIM_USER_AGENT` | User-Agent für Nominatim (OSM Usage Policy)         | Nein    |

## Lokale Entwicklung

```bash
cp .env.local.example .env.local   # Werte eintragen
npm install
npm run dev                         # Fastify-Dev-Server auf http://localhost:3000
npm test                            # Vitest
```

## Deployment (Vercel)

Statisches Frontend aus `public/` + TypeScript Serverless Function in `api/`.

**Wichtig bei `vercel env add`:** Werte mit `printf` statt `<<<` setzen, sonst wird eine Newline angehängt:

```bash
printf 'mein-wert' | vercel env add VARIABLE_NAME production
```

`vercel.json`:
```json
{
  "framework": null,
  "functions": { "api/handler.ts": { "maxDuration": 60 } },
  "rewrites": [
    { "source": "/api/plan",   "destination": "/api/handler" },
    { "source": "/api/health", "destination": "/api/handler" }
  ]
}
```

`framework: null` verhindert, dass Vercel das Projekt als Fastify-Server erkennt und statische Dateien nicht ausliefert.
