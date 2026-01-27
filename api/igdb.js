// TwitchGamesGrid.tsx  (ERSETZ ALLES durch das hier)
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import { GAMES_TEXT } from "./games.list"

// OPTIONAL: nur fürs Cover (kann auch leer bleiben)
const TWITCH_CLIENT_ID = "PASTE_CLIENT_ID_HERE"
const TWITCH_ACCESS_TOKEN = "PASTE_ACCESS_TOKEN_HERE"

// ✅ DEIN PROXY
const IGDB_PROXY_BASE = "https://igdb-one.vercel.app"

type Props = {
  columns: number
  gap: number
  coverHeight: number
  radius: number
  maxWidth: number
  showInfo: boolean
  showDebug: boolean
}

type TwitchGame = { id: string; name: string; box_art_url: string }
type IGDBGame = { id?: number; name?: string; first_release_date?: number; game_modes?: number[] }

const MODE_ID_TO_LABEL: Record<number, string> = {
  1: "Singleplayer",
  2: "Multiplayer",
  3: "Co-op",
  4: "Split-screen",
  5: "MMO",
  6: "Battle Royale",
}

const twitchCache = new Map<string, TwitchGame | null>()
const igdbCache = new Map<string, IGDBGame | null>()

const parseLines = (t: string) =>
  (t || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith("#"))

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr))
}

function canUseTwitch() {
  return (
    TWITCH_CLIENT_ID &&
    TWITCH_ACCESS_TOKEN &&
    !TWITCH_CLIENT_ID.includes("PASTE_") &&
    !TWITCH_ACCESS_TOKEN.includes("PASTE_")
  )
}

function twitchHeaders() {
  return { "Client-ID": TWITCH_CLIENT_ID, Authorization: `Bearer ${TWITCH_ACCESS_TOKEN}` }
}

function boxArt(url: string, w = 600, h = 800) {
  return (url || "").replace("{width}", String(w)).replace("{height}", String(h))
}

function modesText(modeIds?: number[]) {
  const ids = Array.isArray(modeIds) ? modeIds : []
  const labels = ids.map((id) => MODE_ID_TO_LABEL[id]).filter(Boolean)
  return labels.length ? labels.join(" • ") : "Mode: unknown"
}

function releaseText(firstReleaseSec?: number) {
  if (!firstReleaseSec) return "Release: unknown"
  const nowSec = Math.floor(Date.now() / 1000)
  const d = new Date(firstReleaseSec * 1000)
  const date = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
  return firstReleaseSec <= nowSec ? `Released • ${da
