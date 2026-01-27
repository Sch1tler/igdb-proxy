// Vercel: api/igdb.js  (Proxy)
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req.method === "OPTIONS") return res.status(204).end()

  try {
    const q = String(req.query.q || "").trim()
    if (!q) return res.status(400).json({ error: "Missing q" })

    const clientId = process.env.TWITCH_CLIENT_ID
    const token = process.env.TWITCH_ACCESS_TOKEN
    if (!clientId || !token) {
      return res.status(500).json({ error: "Missing env vars", hasClientId: !!clientId, hasToken: !!token })
    }

    const body = `
      search "${q.replace(/"/g, '\\"')}";
      fields name, first_release_date, game_modes;
      limit 10;
    `

    const r = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
        Accept: "application/json",
      },
      body,
    })

    const text = await r.text()
    if (!r.ok) return res.status(r.status).json({ error: "IGDB failed", status: r.status, response: text })

    return res.status(200).send(text)
  } catch (e) {
    return res.status(500).json({ error: "crash", message: e?.message || String(e) })
  }
}
