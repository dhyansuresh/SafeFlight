import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import passport from "passport";
import { configurePassport } from "./lib/passport.js";
import authRoutes from "./routes/auth.js";
import flightRoutes from "./routes/flights.js";
import weatherRoutes from "./routes/weather.js";
import friendRoutes from "./routes/friends.js";
import sharedRoutes from "./routes/shared.js";
import inviteRoutes from "./routes/invite.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
    app.set("trust proxy", 1);
}

if (!isProd) {
    app.use(
        cors({
            origin: process.env.CLIENT_URL ?? "http://localhost:5173",
            credentials: true,
        })
    );
}

app.use(express.json());

const PgStore = connectPgSimple(session);

app.use(
    session({
        store: isProd
            ? new PgStore({
                conString: process.env.DATABASE_URL,
                createTableIfMissing: true,
            })
            : undefined,
        secret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: isProd,
            maxAge: 1000 * 60 * 60 * 24 * 7,
        },
    })
);

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/flights", flightRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/shared", sharedRoutes);
app.use("/api/invite", inviteRoutes);

if (isProd) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const clientDist = path.resolve(__dirname, "../../client/dist");
    console.log("Serving client from:", clientDist);
    app.use(express.static(clientDist));
    app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/")) return next();
        res.sendFile(path.join(clientDist, "index.html"));
    });
}

app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
});