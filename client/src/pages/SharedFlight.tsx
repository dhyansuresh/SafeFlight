import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import FlightMapView, {
  toIcao,
  type MappableFlight,
  type Metar,
  type LivePosition,
} from "../components/FlightMapView";
import { airlineName } from "../lib/airlines";

type SharedFlight = MappableFlight & {
  departureDate: string;
  terminal: string | null;
  gate: string | null;
  originTz: string | null;
  destTz: string | null;
  lastPolledAt: string | null;
  owner: { name: string };
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

function agoLabel(iso: string | null): string {
  if (!iso) return "never";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  return `${Math.round(min / 60)}h ago`;
}

export default function SharedFlightPage() {
  const { token } = useParams<{ token: string }>();
  const [flight, setFlight] = useState<SharedFlight | null>(null);
  const [metars, setMetars] = useState<Metar[]>([]);
  const [live, setLive] = useState<LivePosition | null>(null);
  const [track, setTrack] = useState<[number, number][] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/shared/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("nf");
        return r.json();
      })
      .then((d) => setFlight(d.flight))
      .catch(() => setNotFound(true));
  }, [token]);

  useEffect(() => {
    if (!flight) return;
    const ids = [toIcao(flight.originIata), toIcao(flight.destIata)].join(",");
    fetch(`/api/weather/metar?ids=${ids}`)
      .then((r) => r.json())
      .then((d) => setMetars(Array.isArray(d.metars) ? d.metars : []))
      .catch(() => setMetars([]));
  }, [flight?.originIata, flight?.destIata]);

  useEffect(() => {
    if (!flight || flight.status !== "ACTIVE" || !token) return;
    const load = () => {
      fetch(`/api/shared/${token}/live`)
        .then((r) => r.json())
        .then((d) => {
          setLive(d.position ?? null);
          setTrack(Array.isArray(d.track) ? d.track : null);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [flight?.status, token]);

  async function refresh() {
    if (!token) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/shared/${token}/refresh`, { method: "POST" });
      const d = await res.json();
      if (d.flight) setFlight(d.flight);
    } finally {
      setRefreshing(false);
    }
  }

  if (notFound)
    return (
      <div className="card center">
        <p>This flight link is invalid or has been revoked.</p>
      </div>
    );
  if (!flight) return <p>Loading flight&hellip;</p>;

  return (
    <div>
      <p className="muted">
        {flight.owner.name} shared this flight with you via SafeFlight
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
        <button className="link-btn map-link" onClick={refresh} disabled={refreshing}>
          {refreshing ? "refreshing\u2026" : `refresh (updated ${agoLabel(flight.lastPolledAt)})`}
        </button>
      </p>

      <section className="card">
        <FlightMapView flight={flight} metars={metars} live={live} track={track} />
        {flight.status === "ACTIVE" && !live && (
          <p className="muted hint">
            No live signal right now &mdash; showing an estimated position.
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
            {flight.actualDep && (() => {
              const d = minutesBetween(flight.actualDep, flight.schedDep!);
              if (d > 0) return <span className="delay"> &middot; {d} min late</span>;
              if (d < 0) return <span className="early"> &middot; {-d} min early</span>;
              return <span> &middot; on time</span>;
            })()}
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
            {flight.actualArr && (() => {
              const d = minutesBetween(flight.actualArr, flight.schedArr!);
              if (d > 0) return <span className="delay"> &middot; {d} min late</span>;
              if (d < 0) return <span className="early"> &middot; {-d} min early</span>;
              return <span> &middot; on time</span>;
            })()}
          </p>
        ) : (
          <p className="muted">No arrival time yet.</p>
        )}
      </section>
    </div>
  );
}
