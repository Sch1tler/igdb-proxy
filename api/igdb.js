// api/igdb.js
module.exports = async function handler(req, res) {
  // ✅ CORS (damit Framer & Browser dürfen)
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(204).end()
  }

  try {
    // 🔎 Query
    const q = String(req.query.q || "").trim()
    if (!q) {
      return res.status(400).json({ error: "Missing q parameter" })
    }

    // 🔐 ENV VARS (MÜSSEN in Vercel gesetzt sein)
    const clientId = process.env.TWITCH_CLIENT_ID
    const token = process.env.TWITCH_ACCESS_TOKEN

    if (!clientId || !token) {
      return res.status(500).json({
        error: "Missing env vars",
        hasClientId: Boolean(clientId),
        hasToken: Boolean(token),
      })
    }

    // 🎮 IGDB Query
    const body = `
      search "${q.replace(/"/g, '\\"')}";
      fields id, name, first_release_date, game_modes;
      limit 10;
    `

    const igdbRes = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
        Accept: "application/json",
      },
      body,
    })

    const text = await igdbRes.text()

    if (!igdbRes.ok) {
      return res.status(igdbRes.status).json({
        error: "IGDB request failed",
        status: igdbRes.status,
        response: text,
      })
    }

    // ✅ Erfolg → JSON zurück
    return res.status(200).send(text)
  } catch (err) {
    return res.status(500).json({
      error: "Function crashed",
      message: err?.message || String(err),
    })
  }
}
