# Fotowalk Scout

AI-gestützte Web-App zur Planung von Fotowalks. Gibt Standortvorschläge basierend auf Wetter, Licht und Motivtyp.

## Features

- Geocoding des Startorts via Nominatim (OpenStreetMap)
- Wetteranalyse und -bewertung (Open-Meteo API)
- Astronomische Lichtberechnung (Sonnenaufgang, goldene Stunde, blaue Stunde)
- Spot-Suche via Overpass API (OSM), mit Mirror-Fallback
- KI-generierte Fotografie-Tipps pro Spot (Claude API)
- Ranking der Spots nach Wetter, Licht und Motivtyp
- Web-Frontend mit Leaflet-Karte und Routing-Maschine

## Architektur

```
public/index.html       # Frontend (Leaflet-Karte, Formular)
api/index.ts            # Vercel Serverless Function (Handler für /plan und /health)
src/
  server.ts             # Lokaler Fastify-Dev-Server
  schemas.ts            # Zod-Schemas für Request/Response
  services/
    geo.ts              # Geocoding + Overpass Spot-Suche
    weather.ts          # Open-Meteo Wetterdaten + Scoring
    astronomy.ts        # Lichtbedingungen (SunCalc)
    ranking.ts          # Spot-Ranking
    tips.ts             # KI-Tipps via Claude API
```

## API

### `POST /plan`

```json
{
  "date": "2026-06-25",
  "startLocation": "Zürich",
  "radiusKm": 20,
  "motivTypes": ["wasser", "architektur"]
}
```

Gibt zurück: Standort, Wetter, Lichtbedingungen, bis zu 10 gerankten Spots mit KI-Tipps.

### `GET /health`

```json
{ "status": "ok", "ts": "2026-06-24T10:00:00.000Z" }
```

## Deployment (Vercel)

Die App läuft als statisches Frontend (`public/`) + Serverless Function (`api/index.ts`).

`vercel.json` nutzt `routes` mit `handle: filesystem`, damit Vercel zuerst statische Dateien
ausliefert und `/plan` / `/health` an die API weiterleitet.

```json
{
  "routes": [
    { "src": "/plan", "dest": "/api/index" },
    { "src": "/health", "dest": "/api/index" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

**Wichtig:** `rewrites` allein funktioniert nicht — Vercel würde `/` als Serverless Function
behandeln und mit 504 Timeout antworten.

## Lokale Entwicklung

```bash
cp .env.example .env   # ANTHROPIC_API_KEY setzen
npm install
npm run dev            # Fastify-Dev-Server auf http://localhost:3000
```

## Umgebungsvariablen

| Variable            | Beschreibung                        |
|---------------------|-------------------------------------|
| `ANTHROPIC_API_KEY` | API-Key für Claude (KI-Tipps)       |

## Tests

```bash
npm test
```
