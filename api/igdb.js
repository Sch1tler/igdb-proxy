import type { VercelRequest, VercelResponse } from "@vercel/node"

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID || ""
const IGDB_ACCESS_TOKEN = process.env.IGDB_ACCESS_TOKEN || "" // Bearer Token (Client Credentials)

const MAX_CONCURRENT = 2
const COOLDOWN_MS = 60_000
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 24h
const MIN_DELAY_MS = 250

let inFlight = 0
let cooldownUntil = 0
let lastReqAt = 0
const queue: Array<() => void> = []

const cache = new Map<string, { t: number; v: any }>()

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
  // cooldown
  if (Date.now() < cooldownUntil) {
    await sleep(cooldownUntil - Date.now())
  }

  // concurrency queue
  if (inFlight >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve))
  }

  inFlight++
  try {
    // spacing
    const delta = Date.now() - lastReqAt
    if (delta < MIN_DELAY_MS) await sleep(MIN_DELAY_MS - delta)

    const out = await fn()
    lastReqAt = Date.now()
    return out
  } finally {
    inFlight--
    queue.shift()?.()
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ✅ CORS (sonst "failed to fetch")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Client-ID")

  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" })

  // ✅ Env check (sonst crash)
  if (!IGDB_CLIENT_ID || !IGDB_ACCESS_TOKEN) {
    return res.status(500).json({
      error: "Missing env vars",
      need: ["IGDB_CLIENT_ID", "IGDB_ACCESS_TOKEN"],
    })
  }

  const q = String(req.query.q || "").trim()
  if (!q) return res.status(400).json({ error: "Missing query param: q" })

  const key = q.toLowerCase()

  // ✅ cache
  const cached = cache.get(key)
  if (cached && Date.now() - cached.t < CACHE_TTL_MS) {
    return res.status(200).json(cached.v)
  }

  try {
    const data = await withLimit(async () => {
      const igdbQuery = `
        search "${q.replace(/"/g, '\\"')}";
        fields id,name,first_release_date,game_modes,genres;
        limit 12;
      `

      const r = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
          "Client-ID": IGDB_CLIENT_ID,
          "Authorization": `Bearer ${IGDB_ACCESS_TOKEN}`,
          "Accept": "application/json",
          "Content-Type": "text/plain",
        },
        body: igdbQuery,
      })

      const text = await r.text()

      if (r.status === 429) {
        cooldownUntil = Date.now() + COOLDOWN_MS
        // NICHT crashen – sauber zurückgeben
        return { error: "Too Many Requests", status: 429, cooldown_ms: COOLDOWN_MS }
      }

      if (!r.ok) {
        // NICHT throwen ohne info → sonst sieht man nix
        return { error: "IGDB failed", status: r.status, response: text.slice(0, 2000) }
      }

      // JSON safe
      try {
        return JSON.parse(text)
      } catch {
        return { error: "Non-JSON from IGDB", status: 502, response: text.slice(0, 2000) }
      }
    })

    // wenn 429 -> nicht cachen
    if (!(data && data.status === 429)) {
      cache.set(key, { t: Date.now(), v: data })
    }

    return res.status(200).json(data)
  } catch (e: any) {
    // ✅ verhindert "server crashed"
    return res.status(500).json({
      error: "Proxy crashed (caught)",
      message: String(e?.message || e),
    })
  }
}
