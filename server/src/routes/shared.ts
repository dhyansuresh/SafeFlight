import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { refreshFlight } from "../lib/refreshFlight.js";
import { findLivePosition, fetchTrack, toCallsign } from "../lib/openSky.js";

const router = Router();

async function findByToken(token: string) {
  if (!/^[a-f0-9]{16,64}$/i.test(token)) return null;
  return prisma.flight.findUnique({
    where: { shareToken: token },
    include: { owner: { select: { name: true } } },
  });
}

router.get("/:token", async (req, res) => {
  const flight = await findByToken(req.params.token);
  if (!flight) return res.status(404).json({ error: "Not found" });
  res.json({ flight });
});

router.post("/:token/refresh", async (req, res) => {
  const flight = await findByToken(req.params.token);
  if (!flight) return res.status(404).json({ error: "Not found" });
  const { flight: updated, refreshed } = await refreshFlight(flight);
  res.json({ flight: updated, refreshed });
});

router.get("/:token/live", async (req, res) => {
  const f = await findByToken(req.params.token);
  if (!f) return res.status(404).json({ error: "Not found" });

  if (f.originLat == null || f.originLon == null || f.destLat == null || f.destLon == null) {
    return res.json({ position: null, track: null });
  }
  const callsign = toCallsign(f.airlineIata, f.flightNumber);
  if (!callsign) return res.json({ position: null, track: null });

  const box = {
    laMin: Math.min(f.originLat, f.destLat),
    laMax: Math.max(f.originLat, f.destLat),
    loMin: Math.min(f.originLon, f.destLon),
    loMax: Math.max(f.originLon, f.destLon),
  };
  const position = await findLivePosition(callsign, box);
  const track = position ? await fetchTrack(position.icao24) : null;
  res.json({ position, track });
});

export default router;
