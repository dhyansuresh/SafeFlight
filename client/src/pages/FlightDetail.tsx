import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../App";
import FlightMapView, {
    toIcao,
    type MappableFlight,
    type Metar,
    type LivePosition,
} from "../components/FlightMapView";
import AirlineLogo from "../components/AirlineLogo";
import { airlineName } from "../lib/airlines";

type Flight = MappableFlight & {
    departureDate: string;
    terminal: string | null;
    gate: string | null;
    originTz: string | null;
    destTz: string | null;
    originCity: string | null;
    destCity: string | null;
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
    }, [flight?.originIata, flight?.destIata]);

    useEffect(() => {
        if (!flight || flight.status !== "ACTIVE" || !id) return;
        const load = () => {
            fetch(`/api/flights/${id}/live`, { credentials: "include" })
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
    }, [flight?.status, id]);

    if (loading) return <p>Loading&hellip;</p>;
    if (!user) return <Navigate to="/login" replace />;
    if (notFound)
        return (
            <div className="card center">
                <p>Flight not found.</p>
                <Link to="/">Back to your flights</Link>
            </div>
        );
    if (!flight) return <p>Loading flight&hellip;</p>;

    const isLive =
        flight.status === "ACTIVE" || flight.status === "DIVERTED" || flight.status === "LANDED";

    return (
        <div>
            <p>
                <Link to="/">&larr; Back to your flights</Link>
            </p>

            <div className="detail-head">
                <AirlineLogo iata={flight.airlineIata} height={44} />
                <div>
                    <h1 className="detail-title">
                        {flight.airlineIata}
                        {flight.flightNumber}
                        <span className={flight.status === "ACTIVE" ? "pill pill-live" : "pill"}>
              {STATUS_LABELS[flight.status] ?? flight.status}
            </span>
                    </h1>
                    <p className="muted detail-subtitle">{airlineName(flight.airlineIata)}</p>
                </div>
            </div>

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
                <div className="tile-grid">
                    <div className="tile-box">
                        <span className="tile-label">Route</span>
                        <span className="tile-value">
              {flight.originIata} &rarr; {flight.destIata}
            </span>
                        {(flight.originCity || flight.destCity) && (
                            <span className="tile-sub">
                {flight.originCity ?? flight.originIata} to {flight.destCity ?? flight.destIata}
              </span>
                        )}
                    </div>

                    <div className="tile-box">
                        <span className="tile-label">Date</span>
                        <span className="tile-value">
              {new Date(flight.departureDate).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
              })}
            </span>
                    </div>

                    {flight.schedDep && (
                        <div className="tile-box">
                            <span className="tile-label">Departs &middot; {flight.originIata}</span>
                            <span className="tile-value">
                {time(isLive && flight.actualDep ? flight.actualDep : flight.schedDep, flight.originTz)}
              </span>
                            <span className="tile-sub">
                {isLive && flight.actualDep && <s>{time(flight.schedDep, flight.originTz)} </s>}
                                {flight.terminal && <>Terminal {flight.terminal}</>}
                                {flight.gate && <> &middot; Gate {flight.gate}</>}
              </span>
                        </div>
                    )}

                    {flight.schedArr && (
                        <div className="tile-box">
                            <span className="tile-label">Arrives &middot; {flight.destIata}</span>
                            <span className="tile-value">
                {time(isLive && flight.actualArr ? flight.actualArr : flight.schedArr, flight.destTz)}
              </span>
                            <span className="tile-sub">
                {isLive && flight.actualArr && <s>{time(flight.schedArr, flight.destTz)} </s>}
                                {isLive && flight.actualArr && (() => {
                                    const d = minutesBetween(flight.actualArr, flight.schedArr!);
                                    if (d > 0) return <span className="delay">{d} min late</span>;
                                    if (d < 0) return <span className="early">{-d} min early</span>;
                                    return <span>on time</span>;
                                })()}
              </span>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}