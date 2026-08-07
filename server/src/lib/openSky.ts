const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const API = "https://opensky-network.org/api";

// IATA -> ICAO for the carriers in our dropdown
const AIRLINE_ICAO: Record<string, string> = {
  AA: "AAL",
  AS: "ASA",
  B6: "JBU",
  DL: "DAL",
  F9: "FFT",
  G4: "AAY",
  HA: "HAL",
  MX: "MXY",
  NK: "NKS",
  OO: "SKW",
  UA: "UAL",
  WN: "SWA",
  YX: "RPA",
  "9E": "EDV",
  MQ: "ENY",
  OH: "JIA",
  PT: "PDT",
  SY: "SCX",
  XP: "VXP",
};

export function toCallsign(airlineIata: string, flightNumber: string): string | null {
  const icao = AIRLINE_ICAO[airlineIata.toUpperCase()];
  if (!icao) return null;
  return `${icao}${flightNumber}`;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) {
    console.error("OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET not set");
    return null;
  }

  // Reuse while still valid (with a 60s safety margin).
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      console.error(`OpenSky token request failed: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
    };
    return cachedToken.value;
  } catch (err) {
    console.error("OpenSky token error:", err);
    return null;
  }
}

export type LivePosition = {
  icao24: string;
  callsign: string;
  lat: number;
  lon: number;
  altitudeM: number | null;
  headingDeg: number | null;
  velocityMs: number | null;
  onGround: boolean;
  lastContact: number;
};

/**
 * State vectors come back as positional arrays — the field order is fixed by
 * the API, so we index carefully rather than guessing.
 *   0 icao24 · 1 callsign · 5 lon · 6 lat · 7 baroAlt · 8 onGround
 *   9 velocity · 10 trueTrack · 13 geoAlt
 */
export async function findLivePosition(
  callsign: string,
  box: { laMin: number; loMin: number; laMax: number; loMax: number }
): Promise<LivePosition | null> {
  const token = await getToken();
  if (!token) return null;

  // Pad the box a little — aircraft deviate from the great circle.
  const pad = 2;
  const url =
    `${API}/states/all?lamin=${box.laMin - pad}&lomin=${box.loMin - pad}` +
    `&lamax=${box.laMax + pad}&lomax=${box.loMax + pad}`;

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (res.status === 429) {
      console.warn("OpenSky rate limit reached");
      return null;
    }
    if (!res.ok) {
      console.error(`OpenSky states returned ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { states?: any[][] };
    const states = data.states ?? [];
    const wanted = callsign.trim().toUpperCase();

    const match = states.find(
      (s) => typeof s[1] === "string" && s[1].trim().toUpperCase() === wanted
    );
    if (!match) return null;

    const lon = match[5];
    const lat = match[6];
    if (typeof lat !== "number" || typeof lon !== "number") return null;

    return {
      icao24: match[0],
      callsign: wanted,
      lat,
      lon,
      altitudeM: typeof match[13] === "number" ? match[13] : match[7] ?? null,
      headingDeg: typeof match[10] === "number" ? match[10] : null,
      velocityMs: typeof match[9] === "number" ? match[9] : null,
      onGround: Boolean(match[8]),
      lastContact: match[4] ?? 0,
    };
  } catch (err) {
    console.error("OpenSky states error:", err);
    return null;
  }
}

/**
 * Flown path for an aircraft. time=0 gives the live track of an ongoing flight.
 * This endpoint is flagged experimental by OpenSky, so treat failures as normal.
 * Path rows: [time, lat, lon, baroAltitude, trueTrack, onGround]
 */
export async function fetchTrack(icao24: string): Promise<[number, number][] | null> {
  const token = await getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API}/tracks/all?icao24=${icao24.toLowerCase()}&time=0`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { path?: any[][] };
    const path = data.path ?? [];

    return path
      .filter((p) => typeof p[1] === "number" && typeof p[2] === "number")
      .map((p) => [p[1], p[2]] as [number, number]);
  } catch (err) {
    console.error("OpenSky track error:", err);
    return null;
  }
}
