import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import FlightMapView, {
    toIcao,
    type MappableFlight,
    type Metar,
    type LivePosition,
} from "../components/FlightMapView";
import { airlineName } from "../lib/airlines";
import AirlineLogo from "../components/AirlineLogo";

type SharedFlight = MappableFlight & {
    departureDate: string;
    terminal: string | null;
    gate: string | null;
    originTz: string | null;
    destTz: string | null;
    originCity: string | null;
    destCity: string | null;
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
            <p className="muted">
                <button className="link-btn map-link" onClick={refresh} disabled={refreshing}>
                    {refreshing ? "refreshing…" : `refresh (updated ${agoLabel(flight.lastPolledAt)})`}
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

                    {flight.schedDep && (() => {
                        const isLive =
                            flight.status === "ACTIVE" || flight.status === "DIVERTED" || flight.status === "LANDED";
                        return (
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
                        );
                    })()}

                    {flight.schedArr && (() => {
                        const isLive =
                            flight.status === "ACTIVE" || flight.status === "DIVERTED" || flight.status === "LANDED";
                        return (
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
                        );
                    })()}
                </div>
            </section>
        </div>
    );
}