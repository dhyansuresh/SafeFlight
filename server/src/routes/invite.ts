import { Router } from "express";
import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/:token", async (req, res) => {
  if (!/^[a-f0-9]{16,64}$/i.test(req.params.token)) {
    return res.status(404).json({ error: "Not found" });
  }
  const inviter = await prisma.user.findUnique({
    where: { inviteToken: req.params.token },
    select: { name: true, avatarUrl: true },
  });
  if (!inviter) return res.status(404).json({ error: "Not found" });
  res.json({ inviter });
});

router.post("/mine", requireAuth, async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me) return res.status(404).json({ error: "Not found" });
  if (me.inviteToken) return res.json({ inviteToken: me.inviteToken });

  const token = randomBytes(16).toString("hex");
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { inviteToken: token },
  });
  res.json({ inviteToken: updated.inviteToken });
});

router.post("/:token/accept", requireAuth, async (req, res) => {
  const userId = (req.user as { id: string }).id;
  const inviter = await prisma.user.findUnique({
    where: { inviteToken: req.params.token },
  });
  if (!inviter) return res.status(404).json({ error: "Invite not found" });
  if (inviter.id === userId) return res.json({ ok: true, self: true });

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: inviter.id },
        { requesterId: inviter.id, addresseeId: userId },
      ],
    },
  });

  if (existing) {
    if (existing.status !== "ACCEPTED") {
      await prisma.friendship.update({
        where: { id: existing.id },
        data: { status: "ACCEPTED" },
      });
    }
  } else {
    await prisma.friendship.create({
      data: { requesterId: inviter.id, addresseeId: userId, status: "ACCEPTED" },
    });
  }

  res.json({ ok: true, inviter: { name: inviter.name } });
});

export default router;
