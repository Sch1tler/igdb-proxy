export default async function handler(req, res) {
  try {
    const q = (req.query.q || "").toString().trim()
    if (!q) return res.status(400).json({ error: "Missing q" })

    const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID
    const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN

    if (!TWITCH_CLIENT_ID || !TWITCH_ACCESS_TOKEN) {
      return res.status(500).json({ error: "Missing TWITCH_CLIENT_ID / TWITCH_ACCESS_TOKEN" })
    }

    const body = `
      search "${q.replace(/"/g, '\\"')}";
      fields name, first_release_date, game_modes;
      limit 1;
    `

    const r = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: \`Bearer ${TWITCH_ACCESS_TOKEN}\`,
        "Content-Type": "text/plain",
      },
      body,
    })

    const text = await r.text()
    res.status(r.status).send(text)
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
}
