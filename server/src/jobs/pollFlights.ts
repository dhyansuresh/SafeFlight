import { prisma } from "../lib/prisma.js";
import { fetchFlightStatus } from "../lib/flightProvider.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MIN_POLL_GAP_MIN = 10; // don't re-poll a flight more often than this
const WINDOW_BEFORE_HOURS = 3; // polling departure
const WINDOW_AFTER_HOURS = 2; // stop polling after scheduled arrival

export type PollSummary = {
  considered: number;
  polled: number;
  updated: number;
  skipped: number;
  errors: number;
};

export async function pollFlights(opts: { force?: boolean } = {}): Promise<PollSummary> {
  const now = new Date();
  const summary: PollSummary = { considered: 0, polled: 0, updated: 0, skipped: 0, errors: 0 };

  const todayStr = now.toISOString().slice(0, 10);          // "2026-08-07"
  const dayStart = new Date(`${todayStr}T00:00:00.000Z`);
  const dayEnd = new Date(`${todayStr}T23:59:59.999Z`);

  const flights = await prisma.flight.findMany({
    where: opts.force ? {} : { departureDate: { gte: dayStart, lte: dayEnd } },
  });

  summary.considered = flights.length;

  for (const f of flights) {

    if (!opts.force) {
      const dep = f.schedDep ?? f.departureDate;
      const hasRealTimes = Boolean(f.schedDep);
      const refArr = f.schedArr ?? dep;

      const windowOpen = hasRealTimes
          ? new Date(dep.getTime() - WINDOW_BEFORE_HOURS * 3600_000)
          : new Date(dep.getTime());

      const windowClose = hasRealTimes
          ? new Date(refArr.getTime() + WINDOW_AFTER_HOURS * 3600_000)
          : new Date(dep.getTime() + 36 * 3600_000);

      if (now < windowOpen || now > windowClose) {
        summary.skipped++;
        continue;
      }
      if (f.lastPolledAt && now.getTime() - f.lastPolledAt.getTime() < MIN_POLL_GAP_MIN * 60_000) {
        summary.skipped++;
        continue;
      }
    }

    // Build the provider inputs from stored fields
    const flightNumber = `${f.airlineIata}${f.flightNumber}`;
    const date = (f.schedDep ?? f.departureDate).toISOString().slice(0, 10);

    const status = await fetchFlightStatus(flightNumber, date, {
      originIata: f.originIata,
      destIata: f.destIata,
    });
    summary.polled++;
    await sleep(1200);

    if (!status) {
      summary.errors++;

      await prisma.flight.update({
        where: { id: f.id },
        data: { lastPolledAt: now },
      });
      continue;
    }

    await prisma.flight.update({
      where: { id: f.id },
      data: {
        status: status.status,
        schedDep: status.schedDep ?? f.schedDep,
        schedArr: status.schedArr ?? f.schedArr,
        actualDep: status.actualDep ?? f.actualDep,
        actualArr: status.actualArr ?? f.actualArr,
        terminal: status.terminal ?? f.terminal,
        gate: status.gate ?? f.gate,
        originTz: status.originTz ?? f.originTz,
        destTz: status.destTz ?? f.destTz,
        originLat: status.originLat ?? f.originLat,
        originLon: status.originLon ?? f.originLon,
        destLat: status.destLat ?? f.destLat,
        destLon: status.destLon ?? f.destLon,
        originCity: status.originCity ?? f.originCity,
        destCity: status.destCity ?? f.destCity,
        lastPolledAt: now,
      },
    });
    summary.updated++;
  }

  return summary;
}
