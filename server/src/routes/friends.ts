import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { acceptedFriendIds, friendVisibleFlightWhere } from "../lib/visibility.js";

const router = Router();
router.use(requireAuth);

const publicUser = { id: true, name: true, email: true, avatarUrl: true } as const;

// Exact-email lookup
router.get("/search", async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const email = String(req.query.email ?? "").trim().toLowerCase();
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return res.status(400).json({ error: "Enter a full email address" });

  const found = await prisma.user.findUnique({
    where: { email },
    select: publicUser,
  });
  if (!found || found.id === userId) return res.json({ user: null });
  res.json({ user: found });
});

// Send a request. If they already requested, auto-accept instead.
router.post("/request", async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const addresseeId = String(req.body?.userId ?? "");
  if (!addresseeId || addresseeId === userId) {
    return res.status(400).json({ error: "Invalid user" });
  }

  const target = await prisma.user.findUnique({ where: { id: addresseeId } });
  if (!target) return res.status(404).json({ error: "User not found" });

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId },
        { requesterId: addresseeId, addresseeId: userId },
      ],
    },
  });

  if (existing) {
    if (existing.status === "ACCEPTED") {
      return res.status(409).json({ error: "Already friends" });
    }
    if (existing.requesterId === userId) {
      return res.status(409).json({ error: "Request already sent" });
    }
    // They asked us first — both sides want it, so accept.
    const accepted = await prisma.friendship.update({
      where: { id: existing.id },
      data: { status: "ACCEPTED" },
    });
    return res.json({ friendship: accepted, autoAccepted: true });
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId: userId, addresseeId, status: "PENDING" },
  });
  res.status(201).json({ friendship });
});

// Incoming requests waiting on me.
router.get("/requests", async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const requests = await prisma.friendship.findMany({
    where: { addresseeId: userId, status: "PENDING" },
    include: { requester: { select: publicUser } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ requests });
});

router.post("/requests/:id/accept", async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const result = await prisma.friendship.updateMany({
    where: { id: req.params.id, addresseeId: userId, status: "PENDING" },
    data: { status: "ACCEPTED" },
  });
  if (result.count === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// Decline just deletes the row — re-requesting later is allowed.
router.post("/requests/:id/decline", async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const result = await prisma.friendship.deleteMany({
    where: { id: req.params.id, addresseeId: userId, status: "PENDING" },
  });
  if (result.count === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// My accepted friends.
router.get("/", async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const rows = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: publicUser },
      addressee: { select: publicUser },
    },
  });
  const friends = rows.map((r) => ({
    friendshipId: r.id,
    user: r.requesterId === userId ? r.addressee : r.requester,
  }));
  res.json({ friends });
});

// Unfriend (either side may).
router.delete("/:friendshipId", async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const result = await prisma.friendship.deleteMany({
    where: {
      id: req.params.friendshipId,
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
  if (result.count === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// Friends' flights, filtered by the visibility rule:
// upcoming + en route + landed within the last 5 hours.
router.get("/flights", async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const friendIds = await acceptedFriendIds(userId);
  if (friendIds.length === 0) return res.json({ flights: [] });

  const flights = await prisma.flight.findMany({
    where: {
      ownerId: { in: friendIds },
      ...friendVisibleFlightWhere(),
    },
    include: { owner: { select: publicUser } },
    orderBy: { departureDate: "asc" },
  });
  res.json({ flights });
});

export default router;
