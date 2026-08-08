# SafeFlight

Track your own flights and follow the flights of friends and family with live
positions on a map, delays, gates, and a share link that works without an
account.

Live at [safeflight.onrender.com](https://safeflight.onrender.com)

---

## What it does

- **Google sign-in** — session-based auth, no passwords to manage
- **Flight tracking** — add a flight by airline and number; status, times,
  terminal, and gate come from AeroDataBox
- **Live map** — real ADS-B aircraft positions and flown tracks from OpenSky,
  falling back to a time-interpolated estimate when there's no signal
- **Airport weather** — current conditions at both ends, in plain language
- **Friends** — mutual-consent friendships or instant-add invite links; friends
  see your upcoming and en-route flights, plus anything that landed in the last
  5 hours. Your older history stays yours alone.
- **Share links** — send any single flight as a URL; the recipient needs no
  account
- **Light and dark themes**

## Stack

| Layer    | Choice                                               |
| -------- | ---------------------------------------------------- |
| Client   | React 18, TypeScript, Vite, React Router, Leaflet    |
| Server   | Node, Express 4, TypeScript, Passport (Google OAuth) |
| Database | PostgreSQL via Prisma                                |
| APIs     | AeroDataBox (status), OpenSky (positions), aviationweather.gov (METARs) |

Monorepo using npm workspaces: `client/` and `server/`.

---

## Running locally

### Prerequisites

- Node 20+
- Docker (or a local PostgreSQL 16 instance)
- API credentials — see [Credentials](#credentials) below

### 1. Install

```bash
git clone https://github.com/dhyansuresh/SafeFlight.git
cd SafeFlight
npm install
```

### 2. Start Postgres

```bash
docker run --name safeflight-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=safeflight \
  -p 5432:5432 \
  -v safeflight-data:/var/lib/postgresql/data \
  -d postgres:16
```

Already created it once? `docker start safeflight-db`.

### 3. Configure the server

Create `server/.env` and fill in your own values:

```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/safeflight"
 
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="http://localhost:4000/api/auth/google/callback"
 
SESSION_SECRET="any-long-random-string"
CLIENT_URL="http://localhost:5173"
PORT=4000
 
AERODATABOX_API_KEY="..."
OPENSKY_CLIENT_ID="..."
OPENSKY_CLIENT_SECRET="..."
```

### 4. Run migrations

```bash
npm run db:migrate
```

### 5. Start both apps

```bash
npm run dev
```

- Client: <http://localhost:5173>
- API: <http://localhost:4000>
- Health check: <http://localhost:4000/api/health>

Vite proxies `/api/*` to the server, so the browser only ever talks to port
5173 in development.

---

## Credentials

### Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com) → create a project
2. APIs & Services → Credentials → Create OAuth client ID → Web application
3. Authorized JavaScript origin: `http://localhost:5173`
4. Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
5. While the app is in testing mode, add each tester's email under Audience →
   Test users, or sign-in is blocked

### AeroDataBox (flight status)

Subscribe on [RapidAPI](https://rapidapi.com/aedbx-aedbx/api/aerodatabox); the
free tier allows roughly 600 calls a month. Copy the RapidAPI key.

Quota is why polling is user-initiated: flights refresh when you add them and
when someone presses Refresh, throttled server-side to one call per flight per
10 minutes.

### OpenSky (live positions)

Register at [opensky-network.org](https://opensky-network.org), then create an
API client under your account for a client ID and secret. Auth is OAuth2
client-credentials; tokens are cached in memory and refreshed automatically.

Live positions are optional the data is open-source and provided by volunteers without these the map falls back to estimated
positions and everything else still works.

---

## Useful commands

| Command              | What it does                             |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Client and server together               |
| `npm run dev:client` | Client only                              |
| `npm run dev:server` | Server only                              |
| `npm run build`      | Production build of both workspaces      |
| `npm start`          | Run the built server (serves the client) |
| `npm run db:migrate` | Create and apply a migration             |
| `npm run db:studio`  | Prisma Studio — browse the database      |

---

## Project layout

```
client/src/
  components/    FlightMapView, FriendCard, AirlineLogo
  pages/         Dashboard, FlightDetail, Friends, FriendFlights,
                 SharedFlight, Join, Login
  lib/           airlines.ts, geo.ts (great-circle interpolation)
  App.tsx        Auth context, nav, theme toggle
  styles.css     Design tokens and both themes

server/src/
  routes/        auth, flights, friends, shared, invite, weather, dev
  lib/           flightProvider (AeroDataBox), openSky, refreshFlight,
                 visibility (the sharing rules), passport, prisma
  jobs/          pollFlights
  index.ts       App wiring; serves client/dist in production

server/prisma/
  schema.prisma  Data model
  migrations/    Migration history
```

---

## Design notes

**Times are UTC everywhere in the database.** Conversion happens only at
display, using each airport's IANA timezone rather than the browser's. For example, a flight from Guatemala City to Orlando shows a CST departure and an EDT arrival,
and neither depends on where the viewer sits.

**Authorization lives in queries, never in the UI.** Every flight lookup scopes
by `ownerId` or checks friendship first. `lib/visibility.ts` holds the sharing
rules in one place so all routes agree.

**Share tokens are capability URLs.** 32 hex characters of randomness;
possession of the link is the authorization. Tokens can be revoked, which kills
old links.

**Predicted times are labelled honestly.** AeroDataBox returns a predicted
arrival before departure, so estimates and delay chips only appear once a
flight is actually airborne.

---

## Deployment

Deployed as a single Render web service: Express serves the API and the built
client from one origin, which keeps session cookies first-party. The database
is Neon Postgres, with sessions stored in Postgres via `connect-pg-simple`.

- Build: `npm install --include=dev && npm run build`
- Start: `cd server && npx prisma migrate deploy && cd .. && npm start`

Production also needs `NODE_ENV=production` (enables secure cookies, proxy
trust, and static serving) and `GOOGLE_CALLBACK_URL` / `CLIENT_URL` pointing at
the deployed domain, which must also be registered in the Google Console.

---

## License

MIT