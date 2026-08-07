import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import passport from "passport";
import { configurePassport } from "./lib/passport.js";
import authRoutes from "./routes/auth.js";
import flightRoutes from "./routes/flights.js";
import weatherRoutes from "./routes/weather.js";
import devRoutes from "./routes/dev.js"

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    credentials: true, // allow the session cookie across ports in dev
  })
);
app.use(express.json());

// Session cookie.
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/flights", flightRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/dev", devRoutes);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
