import "dotenv/config";
import { fetchFlightStatus } from "./lib/flightProvider.js";

/**
 * Throwaway script to test the provider in isolation.
 * Run with:  npx tsx src/testProvider.ts AS2223 2026-08-08
 * (pass a real flight number + date as arguments, or edit the defaults below)
 *
 * Delete this file once the polling job is working.
 */
async function main() {
  const flightNumber = process.argv[2] ?? "AS2223";
  const date = process.argv[3] ?? new Date().toISOString().slice(0, 10); // today, YYYY-MM-DD

  console.log(`\nLooking up ${flightNumber} on ${date}...\n`);

  const result = await fetchFlightStatus(flightNumber, date);

  if (!result) {
    console.log("No result — flight not found, or an error occurred.");
    console.log("(Check the console above for an error message from the provider.)");
    return;
  }

  console.log("Parsed result:");
  console.log({
    status: result.status,
    route: `${result.originIata ?? "?"} -> ${result.destIata ?? "?"}`,
    schedDep: result.schedDep?.toISOString() ?? "(none)",
    schedArr: result.schedArr?.toISOString() ?? "(none)",
    predictedArr: result.actualArr?.toISOString() ?? "(none)",
    terminal: result.terminal ?? "(none)",
    gate: result.gate ?? "(none)",
  });
  console.log("");
}

main();
