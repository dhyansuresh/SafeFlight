import { Router } from "express";
import passport from "passport";

const router = Router();
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

// Step 1: kick off the OAuth dance
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Step 3/4: Google sends the user back here
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${CLIENT_URL}/login?error=1` }),
  (_req, res) => {
    res.redirect(CLIENT_URL); // session cookie is now set
  }
);

// Who am I? The client calls this on load to hydrate auth state.
router.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ user: null });
  const { id, email, name, avatarUrl } = req.user as {
    id: string; email: string; name: string; avatarUrl: string | null;
  };
  res.json({ user: { id, email, name, avatarUrl } });
});

router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => res.json({ ok: true }));
  });
});

export default router;
