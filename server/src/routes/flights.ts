import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

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
