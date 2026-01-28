import type { VercelRequest, VercelResponse } from "@vercel/node"

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID!
const IGDB_TOKEN = process.env.IGDB_ACCESS_TOKEN!

// ====== RATE LIMIT ======
const MAX_CONCURRENT = 2
const COOLDOWN_MS = 60_000

let inFlight = 0
let cooldownUntil = 0
const queue: Array<() => void> = []

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (Date.now() < cooldownUntil) {
    throw new Error("IGDB cooldown active")
  }

  if (inFlight >= MAX_CONCURRENT) {
    await new Promise<void>(res => queue.push(res))
  }

  inFlight++
  try {
    return await fn()
  } finally {
    inFlight--
    queue.shift()?.()
  }
}

// ====== SIMPLE CACHE ======
const cache = new Map<string, { time: number; data: any }>()
const CACHE_TTL = 1000 * 60 * 60 // 1h

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" })
  }

  const query = req.body?.query
  if (!query) {
    return res.status(400).json({ error: "Missing query" })
  }

  const cacheKey = query.trim()
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return res.status(200).json(cached.data)
  }

  try {
    const data = await withLimit(async () => {
      const r = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
          "Client-ID": IGDB_CLIENT_ID,
          "Authorization": `Bearer ${IGDB_TOKEN}`,
          "Accept": "application/json",
        },
        body: query,
      })

      if (r.status === 429) {
        cooldownUntil = Date.now() + COOLDOWN_MS
        throw new Error("IGDB rate limit hit")
      }

      if (!r.ok) {
        throw new Error(`IGDB failed ${r.status}`)
      }

      return r.json()
    })

    cache.set(cacheKey, { time: Date.now(), data })
    res.status(200).json(data)
  } catch (e: any) {
    res.status(429).json({
      error: "IGDB request failed",
      status: 429,
      message: e.message,
    })
  }
}
