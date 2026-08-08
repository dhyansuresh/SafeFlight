import { prisma } from "./prisma.js";
import { fetchFlightStatus } from "./flightProvider.js";
import type { Flight } from "@prisma/client";

export const REFRESH_MIN_GAP_MIN = 10;

export async function refreshFlight(
    flight: Flight
): Promise<{ flight: Flight; refreshed: boolean }> {
  const now = new Date();

  if (
      flight.lastPolledAt &&
      now.getTime() - flight.lastPolledAt.getTime() < REFRESH_MIN_GAP_MIN * 60_000
  ) {
    return { flight, refreshed: false };
  }

  const flightNumber = `${flight.airlineIata}${flight.flightNumber}`;
  const date = (flight.schedDep ?? flight.departureDate).toISOString().slice(0, 10);

  const status = await fetchFlightStatus(flightNumber, date, {
    originIata: flight.originIata,
    destIata: flight.destIata,
  });

  if (!status) {
    const updated = await prisma.flight.update({
      where: { id: flight.id },
      data: { lastPolledAt: now },
    });
    return { flight: updated, refreshed: false };
  }

  const updated = await prisma.flight.update({
    where: { id: flight.id },
    data: {
      status: status.status,
      schedDep: status.schedDep ?? flight.schedDep,
      schedArr: status.schedArr ?? flight.schedArr,
      actualDep: status.actualDep ?? flight.actualDep,
      actualArr: status.actualArr ?? flight.actualArr,
      terminal: status.terminal ?? flight.terminal,
      gate: status.gate ?? flight.gate,
      originTz: status.originTz ?? flight.originTz,
      destTz: status.destTz ?? flight.destTz,
      originCity: status.originCity ?? flight.originCity,
      destCity: status.destCity ?? flight.destCity,
      originLat: status.originLat ?? flight.originLat,
      originLon: status.originLon ?? flight.originLon,
      destLat: status.destLat ?? flight.destLat,
      destLon: status.destLon ?? flight.destLon,
      lastPolledAt: now,
    },
  });
  return { flight: updated, refreshed: true };
}