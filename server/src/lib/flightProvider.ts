import type { FlightStatus } from "@prisma/client";

const HOST = "aerodatabox.p.rapidapi.com";

export type FlightStatusResult = {
  status: FlightStatus;
  schedDep?: Date;
  schedArr?: Date;
  actualDep?: Date;
  actualArr?: Date;
  terminal?: string;
  gate?: string;
  originIata?: string;
  destIata?: string;
  originTz?: string;
  destTz?: string;
};

function mapStatus(raw: string | undefined): FlightStatus {
  const s = (raw ?? "").toLowerCase();

  if (s === "enroutetodeparture") return "SCHEDULED";

  switch (s) {
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

function parseUtc(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const iso = raw.replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function fetchFlightStatus(
    flightNumber: string,
    dateYYYYMMDD: string,
    expected?: { originIata?: string; destIata?: string }
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

    if (res.status === 404) return null;
    if (res.status === 429) {
      console.warn(`Rate limited by AeroDataBox on ${flightNumber}`);
      return null;
    }
    if (!res.ok) {
      console.error(`AeroDataBox returned ${res.status} for ${flightNumber}`);
      return null;
    }

    const data = (await res.json()) as any;
    const list = Array.isArray(data) ? data : [];
    if (list.length === 0) return null;

    const candidates = list.filter(
        (x: any) =>
            (!expected?.originIata || x.departure?.airport?.iata === expected.originIata) &&
            (!expected?.destIata || x.arrival?.airport?.iata === expected.destIata)
    );

    if (candidates.length === 0) {
      console.warn(
          `No leg of ${flightNumber} on ${dateYYYYMMDD} matched ` +
          `${expected?.originIata ?? "?"} -> ${expected?.destIata ?? "?"}`
      );
      return null;
    }

    const nowMs = Date.now();
    const stillGoing = candidates.filter((x: any) => {
      const arr = parseUtc(x.arrival?.scheduledTime?.utc);
      return !arr || arr.getTime() > nowMs;
    });

    const byDeparture = (a: any, b: any) =>
        (parseUtc(a.departure?.scheduledTime?.utc)?.getTime() ?? 0) -
        (parseUtc(b.departure?.scheduledTime?.utc)?.getTime() ?? 0);

    const flight = (stillGoing.length ? stillGoing : candidates).sort(byDeparture)[0];

    return {
      status: mapStatus(flight.status),
      schedDep: parseUtc(flight.departure?.scheduledTime?.utc),
      schedArr: parseUtc(flight.arrival?.scheduledTime?.utc),
      actualDep: parseUtc(flight.departure?.predictedTime?.utc),
      actualArr: parseUtc(flight.arrival?.predictedTime?.utc),
      terminal: flight.departure?.terminal ?? undefined,
      gate: flight.departure?.gate ?? undefined,
      originIata: flight.departure?.airport?.iata ?? undefined,
      destIata: flight.arrival?.airport?.iata ?? undefined,
      originTz: flight.departure?.airport?.timeZone ?? undefined,
      destTz: flight.arrival?.airport?.timeZone ?? undefined,
    };
  } catch (err) {
    console.error(`Failed to fetch status for ${flightNumber}:`, err);
    return null;
  }
}