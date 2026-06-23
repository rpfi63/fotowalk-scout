import { cfg } from '../config.js'

interface FetchOptions extends RequestInit {
  timeoutMs?: number
  retries?: number
}

/**
 * fetch-Wrapper mit Timeout und Retry-Logik.
 * Setzt automatisch den User-Agent (Nominatim Usage Policy).
 */
export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 10_000, retries = 2, headers, ...rest } = options

  const mergedHeaders = {
    'User-Agent': cfg.nominatimUserAgent,
    'Accept': 'application/json',
    ...(headers as Record<string, string> ?? {}),
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...rest,
        headers: mergedHeaders,
        signal: controller.signal,
      })
      clearTimeout(timer)
      return response
    } catch (err) {
      clearTimeout(timer)
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < retries) {
        // kurze Wartezeit zwischen Versuchen (500ms * attempt)
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }
  }

  throw lastError ?? new Error('Fetch fehlgeschlagen')
}
