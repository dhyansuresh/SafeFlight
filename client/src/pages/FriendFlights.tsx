import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../App";
import AirlineLogo from "../components/AirlineLogo";
import { airlineName } from "../lib/airlines";

type Owner = { id: string; name: string; avatarUrl: string | null };

type Flight = {
  id: string;
  airlineIata: string;
  flightNumber: string;
  departureDate: string;
  originIata: string;
  destIata: string;
  originCity: string | null;
  destCity: string | null;
  status: string;
  schedDep: string | null;
  schedArr: string | null;
  actualDep: string | null;
  actualArr: string | null;
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

export default function FriendFlights() {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading } = useAuth();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || !userId) return;
    fetch(`/api/friends/${userId}/flights`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setOwner(d.owner);
        setFlights(d.flights ?? []);
      })
      .catch(() => setNotFound(true));
  }, [user, userId]);

  if (loading) return <p>Loading&hellip;</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (notFound)
    return (
      <div className="card center">
        <p>Not found.</p>
        <Link to="/">Back to your flights</Link>
      </div>
    );
  if (!owner) return <p>Loading&hellip;</p>;

  const enRoute = flights.filter((f) => f.status === "ACTIVE" || f.status === "DIVERTED");
  const upcoming = flights.filter((f) => f.status !== "ACTIVE" && f.status !== "DIVERTED");

  return (
    <div>
      <p>
        <Link to="/">&larr; Back to your flights</Link>
      </p>

      <div className="detail-head">
        {owner.avatarUrl ? (
          <img className="avatar avatar-lg-sm" src={owner.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="avatar avatar-lg-sm avatar-fallback">{owner.name.charAt(0)}</div>
        )}
        <div>
          <h1 className="detail-title">{owner.name}</h1>
          <p className="muted detail-subtitle">
            {flights.length === 0
              ? "No flights to show"
              : `${flights.length} flight${flights.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {flights.length === 0 && (
        <section className="card center">
          <p className="muted">
            {owner.name.split(" ")[0]} has no upcoming or active flights right now.
          </p>
        </section>
      )}

      {enRoute.length > 0 && (
        <FlightGroup title="In the air" flights={enRoute} />
      )}
      {upcoming.length > 0 && <FlightGroup title="Upcoming" flights={upcoming} />}
    </div>
  );
}

function FlightGroup({ title, flights }: { title: string; flights: Flight[] }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <ul className="flight-list">
        {flights.map((f) => {
          const live =
            f.status === "ACTIVE" || f.status === "DIVERTED" || f.status === "LANDED";
          return (
            <li key={f.id} className="flight-tile">
              <div className="tile-head">
                <div className="tile-id">
                  <AirlineLogo iata={f.airlineIata} />
                  <strong>
                    {f.airlineIata}
                    {f.flightNumber}
                  </strong>
                  <span className="muted">{airlineName(f.airlineIata)}</span>
                  <span className={f.status === "ACTIVE" ? "pill pill-live" : "pill"}>
                    {STATUS_LABELS[f.status] ?? f.status}
                  </span>
                </div>
                <div className="tile-actions">
                  <Link className="link-btn map-link" to={`/flight/${f.id}`}>
                    map
                  </Link>
                </div>
              </div>

              <div className="tile-grid">
                <div className="tile-box">
                  <span className="tile-label">Route</span>
                  <span className="tile-value">
                    {f.originIata} &rarr; {f.destIata}
                  </span>
                  {(f.originCity || f.destCity) && (
                    <span className="tile-sub">
                      {f.originCity ?? f.originIata} to {f.destCity ?? f.destIata}
                    </span>
                  )}
                </div>

                <div className="tile-box">
                  <span className="tile-label">Date</span>
                  <span className="tile-value">
                    {new Date(f.departureDate).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </span>
                </div>

                {f.schedDep && (
                  <div className="tile-box">
                    <span className="tile-label">Departs &middot; {f.originIata}</span>
                    <span className="tile-value">
                      {time(live && f.actualDep ? f.actualDep : f.schedDep, f.originTz)}
                    </span>
                    <span className="tile-sub">
                      {live && f.actualDep && <s>{time(f.schedDep, f.originTz)} </s>}
                      {f.terminal && <>Terminal {f.terminal}</>}
                      {f.gate && <> &middot; Gate {f.gate}</>}
                    </span>
                  </div>
                )}

                {f.schedArr && (
                  <div className="tile-box">
                    <span className="tile-label">Arrives &middot; {f.destIata}</span>
                    <span className="tile-value">
                      {time(live && f.actualArr ? f.actualArr : f.schedArr, f.destTz)}
                    </span>
                    <span className="tile-sub">
                      {live && f.actualArr && <s>{time(f.schedArr, f.destTz)} </s>}
                      {live && f.actualArr && (() => {
                        const d = minutesBetween(f.actualArr, f.schedArr!);
                        if (d > 0) return <span className="delay">{d} min late</span>;
                        if (d < 0) return <span className="early">{-d} min early</span>;
                        return <span>on time</span>;
                      })()}
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
