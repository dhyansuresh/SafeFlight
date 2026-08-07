import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { pollFlights } from "../jobs/pollFlights.js";

/**
 * Development-only helpers. Guarded two ways:
 *  - requireAuth (must be signed in)
 *  - disabled entirely when NODE_ENV === "production"
 * Delete or lock this down before deploying.
 */
const router = Router();

router.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }
  next();
});

router.use(requireAuth);

// POST /api/dev/poll        -> poll flights in the active window
// POST /api/dev/poll?force=1 -> poll ALL flights (ignores window; uses quota)
router.post("/poll", async (req, res) => {
  const force = req.query.force === "1" || req.query.force === "true";
  const summary = await pollFlights({ force });
  res.json({ ok: true, force, summary });
});

export default router;
