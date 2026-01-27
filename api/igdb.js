module.exports = async function handler(req, res) {
  try {
    const q = String(req.query.q || "").trim()
    if (!q) {
      res.statusCode = 400
      return res.json({ error: "Missing q parameter" })
    }

    const clientId = process.env.TWITCH_CLIENT_ID
    const token = process.env.TWITCH_ACCESS_TOKEN

    if (!clientId || !token) {
      res.statusCode = 500
      return res.json({
        error: "Missing env vars",
        hasClientId: Boolean(clientId),
        hasToken: Boolean(token),
      })
    }

    const body = `
      search "${q.replace(/"/g, '\\"')}";
      fields name, first_release_date, game_modes;
      limit 1;
    `

    const r = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body,
    })

    const text = await r.text()

    if (!r.ok) {
      res.statusCode = r.status
      return res.json({
        error: "IGDB request failed",
        status: r.status,
        response: text,
      })
    }

    res.statusCode = 200
    return res.send(text)
  } catch (err) {
    res.statusCode = 500
    return res.json({
      error: "Function crashed",
      message: err?.message || String(err),
    })
  }
}
