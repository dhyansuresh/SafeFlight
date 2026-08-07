import type { FlightStatus } from "@prisma/client";

/**
 * Wraps the AeroDataBox flight-status API (via RapidAPI).
 *
 * The rest of the app never talks to AeroDataBox directly — it calls
 * fetchFlightStatus() and gets back a clean, app-shaped object. If we ever
 * swap providers, this is the only file that changes.
 *
 * Response shape (see the real sample we tested):
 *   [ { departure: { scheduledTime: { utc }, terminal, gate? },
 *       arrival:   { scheduledTime: { utc }, predictedTime?: { utc } },
 *       status, aircraft, airline, ... } ]
 * Note it's an ARRAY, times are nested objects, and gate/terminal may be absent.
 */

const HOST = "aerodatabox.p.rapidapi.com";

// The provider returns this clean shape. Everything optional because the
// external API frequently omits fields (gate especially).
export type FlightStatusResult = {
  status: FlightStatus;
  schedDep?: Date;
  schedArr?: Date;
  actualArr?: Date;
  terminal?: string;
  gate?: string;
  originIata?: string;
  destIata?: string;
};

// AeroDataBox's status words -> our Prisma enum.
function mapStatus(raw: string | undefined): FlightStatus {
  switch ((raw ?? "").toLowerCase()) {
    case "expected":
    case "scheduled":
    case "checkin":
    case "boarding":
    case "gateclosed":
      return "SCHEDULED";
    case "departed":
    case "enroute":
    case "approaching":
      return "ACTIVE";
    case "arrived":
      return "LANDED";
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    case "diverted":
      return "DIVERTED";
    default:
      return "UNKNOWN";
  }
}

// AeroDataBox times look like "2026-08-08 02:48Z" (space, not 'T').
// new Date() wants ISO — swap the space for 'T' so it parses reliably.
function parseUtc(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const iso = raw.replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Fetch status for one flight by IATA number (e.g. "AS2223") and date.
 * Returns null if the flight isn't found or the API errors.
 */
export async function fetchFlightStatus(
  flightNumber: string,
  dateYYYYMMDD: string
): Promise<FlightStatusResult | null> {
  const key = process.env.AERODATABOX_API_KEY;
  if (!key) {
    console.error("AERODATABOX_API_KEY is not set");
    return null;
  }

  const url = `https://${HOST}/flights/number/${encodeURIComponent(
    flightNumber
  )}/${dateYYYYMMDD}`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": HOST,
      },
    });

    if (res.status === 404) return null; // flight not found for that date
    if (!res.ok) {
      console.error(`AeroDataBox returned ${res.status} for ${flightNumber}`);
      return null;
    }

    const data = (await res.json()) as unknown;
    // Response is an array; take the first match.
    const flight = Array.isArray(data) ? data[0] : undefined;
    if (!flight) return null;

    return {
      status: mapStatus(flight.status),
      schedDep: parseUtc(flight.departure?.scheduledTime?.utc),
      schedArr: parseUtc(flight.arrival?.scheduledTime?.utc),
      actualArr: parseUtc(flight.arrival?.predictedTime?.utc),
      terminal: flight.departure?.terminal ?? undefined,
      gate: flight.departure?.gate ?? undefined,
      originIata: flight.departure?.airport?.iata ?? undefined,
      destIata: flight.arrival?.airport?.iata ?? undefined,
    };
  } catch (err) {
    console.error(`Failed to fetch status for ${flightNumber}:`, err);
    return null;
  }
}
