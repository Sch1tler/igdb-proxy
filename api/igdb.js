async function getIGDB(name: string): Promise<IGDBGame | null> {
  const key = name.toLowerCase()
  if (igdbCache.has(key)) return igdbCache.get(key)!

  // localStorage cache (falls vorhanden & frisch)
  const ls = loadIgdbLS()
  const hit = ls[key]
  if (hit && Date.now() - hit.t < IGDB_LS_TTL_MS) {
    igdbCache.set(key, hit.v)
    return hit.v
  }

  // Cooldown nach 429
  if (Date.now() < igdbCooldownUntil) {
    igdbCache.set(key, null)
    return null
  }

  const base = IGDB_PROXY_BASE.replace(/\/$/, "")
  const url = `${base}/api/igdb?q=${encodeURIComponent(name)}&t=${Date.now()}`

  const run = async () => {
    let lastText = ""
    for (let attempt = 0; attempt <= IGDB_MAX_RETRIES; attempt++) {
      // exponential backoff (0ms, 500ms, 1000ms, 2000ms, 4000ms…)
      if (attempt > 0) await sleep(500 * 2 ** (attempt - 1))

      const r = await fetch(url)
      lastText = await r.text()

      // 429 → cooldown setzen + retry
      if (r.status === 429) {
        igdbCooldownUntil = Date.now() + IGDB_COOLDOWN_MS
        continue
      }

      // andere Fehler → kein Spam, einfach null
      if (!r.ok) {
        igdbCache.set(key, null)
        ls[key] = { t: Date.now(), v: null }
        saveIgdbLS(ls)
        return null
      }

      // parse JSON
      let j: any
      try {
        j = JSON.parse(lastText)
      } catch {
        igdbCache.set(key, null)
        ls[key] = { t: Date.now(), v: null }
        saveIgdbLS(ls)
        return null
      }

      const best = pickBestIGDB(Array.isArray(j) ? j : [], name)
      igdbCache.set(key, best)
      ls[key] = { t: Date.now(), v: best }
      saveIgdbLS(ls)
      return best
    }

    // wenn nach retries immer 429: still fallback
    igdbCache.set(key, null)
    ls[key] = { t: Date.now(), v: null }
    saveIgdbLS(ls)
    return null
  }

  // ✅ concurrency limit, damit nicht 50 requests gleichzeitig rausgehen
  return withIgdbConcurrency(run)
}
