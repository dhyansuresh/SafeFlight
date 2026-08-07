import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../App";
import FlightMapView, {
  toIcao,
  type MappableFlight,
  type Metar,
  type LivePosition,
} from "../components/FlightMapView";
import { airlineName } from "../lib/arlines";

type Flight = MappableFlight & {
  departureDate: string;
  terminal: string | null;
  gate: string | null;
  originTz: string | null;
  destTz: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  ACTIVE: "En route",
  LANDED: "Landed",
  CANCELLED: "Cancelled",
  DIVERTED: "Diverted",
  UNKNOWN: "\u2014",
};

const time = (iso: string, tz?: string | null) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz ?? undefined,
    timeZoneName: "short",
  });

const minutesBetween = (a: string, b: string) =>
  Math.round((new Date(a).getTime() - new Date(b).getTime()) / 60000);

function Delta({ actual, scheduled }: { actual: string; scheduled: string }) {
  const d = minutesBetween(actual, scheduled);
  if (d > 0) return <span className="delay"> &middot; {d} min late</span>;
  if (d < 0) return <span className="early"> &middot; {-d} min early</span>;
  return <span> &middot; on time</span>;
}

export default function FlightDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [flight, setFlight] = useState<Flight | null>(null);
  const [metars, setMetars] = useState<Metar[]>([]);
  const [live, setLive] = useState<LivePosition | null>(null);
  const [track, setTrack] = useState<[number, number][] | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    fetch(`/api/flights/${id}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d) => setFlight(d.flight))
      .catch(() => setNotFound(true));
  }, [user, id]);

  useEffect(() => {
    if (!flight) return;
    const ids = [toIcao(flight.originIata), toIcao(flight.destIata)].join(",");
    fetch(`/api/weather/metar?ids=${ids}`)
      .then((r) => r.json())
      .then((d) => setMetars(Array.isArray(d.metars) ? d.metars : []))
      .catch(() => setMetars([]));
  }, [flight]);

  // Live ADS-B position. Only worth asking while the flight is airborne.
  useEffect(() => {
    if (!flight || flight.status !== "ACTIVE") return;

    const load = () => {
      fetch(`/api/flights/${flight.id}/live`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          setLive(d.position ?? null);
          setTrack(Array.isArray(d.track) ? d.track : null);
        })
        .catch(() => {});
    };

    load();
    const timer = setInterval(load, 60_000); // refresh once a minute
    return () => clearInterval(timer);
  }, [flight]);

  if (loading) return <p>Loading&hellip;</p>;
  if (!user)
    return (
      <div className="card center">
        <p>
          <Link to="/login">Sign in</Link> to view this flight.
        </p>
      </div>
    );
  if (notFound)
    return (
      <div className="card center">
        <p>Flight not found.</p>
        <Link to="/">Back to your flights</Link>
      </div>
    );
  if (!flight) return <p>Loading flight&hellip;</p>;

  return (
    <div>
      <p>
        <Link to="/">&larr; Back to your flights</Link>
      </p>

      <h1>
        {flight.airlineIata}
        {flight.flightNumber}{" "}
        <span className="muted">{airlineName(flight.airlineIata)}</span>
      </h1>
      <p className="muted">
        {flight.originIata} &rarr; {flight.destIata} &middot;{" "}
        {new Date(flight.departureDate).toLocaleDateString([], { timeZone: "UTC" })} &middot;{" "}
        {STATUS_LABELS[flight.status] ?? flight.status}
      </p>

      <section className="card">
        <FlightMapView flight={flight} metars={metars} live={live} track={track} />
        {flight.status === "ACTIVE" && !live && (
          <p className="muted hint">
            No live signal for this aircraft right now &mdash; showing an
            estimated position. Coverage depends on volunteer ground receivers.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Departure &middot; {flight.originIata}</h2>
        {flight.schedDep ? (
          <p>
            {time(flight.actualDep ?? flight.schedDep, flight.originTz)}
            {flight.actualDep && (
              <s className="muted"> {time(flight.schedDep, flight.originTz)}</s>
            )}
            {flight.actualDep && (
              <Delta actual={flight.actualDep} scheduled={flight.schedDep} />
            )}
            {flight.terminal && <> &middot; Terminal {flight.terminal}</>}
            {flight.gate && <> &middot; Gate {flight.gate}</>}
          </p>
        ) : (
          <p className="muted">No departure time yet.</p>
        )}
      </section>

      <section className="card">
        <h2>Arrival &middot; {flight.destIata}</h2>
        {flight.schedArr ? (
          <p>
            {time(flight.actualArr ?? flight.schedArr, flight.destTz)}
            {flight.actualArr && (
              <s className="muted"> {time(flight.schedArr, flight.destTz)}</s>
            )}
            {flight.actualArr && (
              <Delta actual={flight.actualArr} scheduled={flight.schedArr} />
            )}
          </p>
        ) : (
          <p className="muted">No arrival time yet.</p>
        )}
      </section>
    </div>
  );
}
