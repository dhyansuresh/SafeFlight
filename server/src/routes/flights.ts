import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { findLivePosition, fetchTrack, toCallsign } from "../lib/openSky.js";
import { canViewFlightsOf, friendVisibleFlightWhere } from "../lib/visibility.js";

const router = Router();
router.use(requireAuth);

const createFlightSchema = z.object({
  airlineIata: z.string().min(2).max(3).toUpperCase(),
  flightNumber: z.string().min(1).max(5),
  departureDate: z.coerce.date(),
  originIata: z.string().length(3).toUpperCase(),
  destIata: z.string().length(3).toUpperCase(),
  schedDep: z.coerce.date().optional(),
  schedArr: z.coerce.date().optional(),
});

// List my flights. ?when=upcoming | past | all
router.get("/", async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const when = req.query.when ?? "all";
  const now = new Date();

  const flights = await prisma.flight.findMany({
    where: {
      ownerId: userId,
      ...(when === "upcoming" ? { departureDate: { gte: now } } : {}),
      ...(when === "past" ? { departureDate: { lt: now } } : {}),
    },
    orderBy: { departureDate: when === "past" ? "desc" : "asc" },
  });
  res.json({ flights });
});

// One flight. Visible to the owner always, and to accepted friends while the
// flight is upcoming, en route, or landed within the visibility window.
router.get("/:id", async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const flight = await prisma.flight.findFirst({
    where: { id: req.params.id },
    include: { owner: { select: { id: true, name: true } } },
  });
  if (!flight) return res.status(404).json({ error: "Not found" });

  if (flight.ownerId !== userId) {
    const allowed = await canViewFlightsOf(userId, flight.ownerId);
    if (!allowed) return res.status(404).json({ error: "Not found" });

    const visible = await prisma.flight.findFirst({
      where: { id: flight.id, ...friendVisibleFlightWhere() },
    });
    if (!visible) return res.status(404).json({ error: "Not found" });
  }

  res.json({ flight });
});

// Live ADS-B position + flown track for one flight, via OpenSky.
router.get("/:id/live", async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const f = await prisma.flight.findFirst({ where: { id: req.params.id } });
  if (!f) return res.status(404).json({ error: "Not found" });
  if (f.ownerId !== userId) {
    const allowed = await canViewFlightsOf(userId, f.ownerId);
    if (!allowed) return res.status(404).json({ error: "Not found" });
  }

  if (f.originLat == null || f.originLon == null || f.destLat == null || f.destLon == null) {
    return res.json({ position: null, track: null, reason: "no coordinates yet" });
  }

  const callsign = toCallsign(f.airlineIata, f.flightNumber);
  if (!callsign) {
    return res.json({ position: null, track: null, reason: "unknown airline ICAO" });
  }

  const box = {
    laMin: Math.min(f.originLat, f.destLat),
    laMax: Math.max(f.originLat, f.destLat),
    loMin: Math.min(f.originLon, f.destLon),
    loMax: Math.max(f.originLon, f.destLon),
  };

  const position = await findLivePosition(callsign, box);
  const track = position ? await fetchTrack(position.icao24) : null;

  res.json({ position, track, callsign });
});

router.post("/", async (req, res) => {
  const parsed = createFlightSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const userId = (req.user as { id: string }).id;
  const flight = await prisma.flight.create({
    data: { ...parsed.data, ownerId: userId },
  });
  res.status(201).json({ flight });
});

router.delete("/:id", async (req, res) => {
  const userId = (req.user as { id: string }).id;
  // deleteMany with ownerId ensures users can only delete their OWN flights
  const result = await prisma.flight.deleteMany({
    where: { id: req.params.id, ownerId: userId },
  });
  if (result.count === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

export default router;
