import { Router } from "express";

const router = Router();

/**
 * Proxy for aviationweather.gov METARs.
 * Why proxy instead of calling from the browser?
 *  - avoids CORS issues
 *  - lets us cache so we're polite to a free government API
 *  - keeps a single place to add rate limiting later
 *
 * GET /api/weather/metar?ids=KMCO,KJFK
 * Note: aviationweather.gov wants ICAO codes (KMCO), not IATA (MCO).
 * US airports are usually "K" + IATA; store real ICAO in the Airport table.
 */
const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 10 * 60 * 1000; // METARs update ~hourly; 10 min is plenty fresh

router.get("/metar", async (req, res) => {
  const ids = String(req.query.ids ?? "").toUpperCase();
  if (!/^[A-Z0-9]{3,4}(,[A-Z0-9]{3,4})*$/.test(ids)) {
    return res.status(400).json({ error: "ids must be comma-separated ICAO codes" });
  }

  const hit = cache.get(ids);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return res.json({ cached: true, metars: hit.data });
  }

  try {
    const url = `https://aviationweather.gov/api/data/metar?ids=${ids}&format=json`;
    const r = await fetch(url, { headers: { "User-Agent": "safeflight-student-project" } });
    if (!r.ok) throw new Error(`aviationweather.gov returned ${r.status}`);
    const data = await r.json();
    cache.set(ids, { at: Date.now(), data });
    res.json({ cached: false, metars: data });
  } catch (err) {
    console.error("METAR fetch failed:", err);
    res.status(502).json({ error: "Weather source unavailable" });
  }
});

export default router;
