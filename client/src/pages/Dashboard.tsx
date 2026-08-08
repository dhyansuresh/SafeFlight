import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../App";
import { Link, Navigate } from "react-router-dom";
import { AIRLINES, airlineName } from "../lib/airlines";
import FlightMapView, { toIcao, type Metar, type LivePosition } from "../components/FlightMapView";
import AirlineLogo from "../components/AirlineLogo";
import FriendCard from "../components/FriendCard";

type Flight = {
  id: string;
  airlineIata: string;
  flightNumber: string;
  departureDate: string;
  originIata: string;
  destIata: string;
  status: string;
  schedDep: string | null;
  schedArr: string | null;
  actualDep: string | null;
  actualArr: string | null;
  terminal: string | null;
  gate: string | null;
  originTz: string | null;
  destTz: string | null;
  originCity: string | null;
  destCity: string | null;
  originLat: number | null;
  originLon: number | null;
  destLat: number | null;
  destLon: number | null;
  lastPolledAt: string | null;
};

type FriendFlight = Flight & { owner: { id: string; name: string; avatarUrl: string | null } };
type FriendUser = { id: string; name: string; avatarUrl: string | null };

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  ACTIVE: "En route",
  LANDED: "Landed",
  CANCELLED: "Cancelled",
  DIVERTED: "Diverted",
  UNKNOWN: "\u2014",
};

const dayOf = (iso: string) => iso.slice(0, 10);
const todayUTC = () => new Date().toISOString().slice(0, 10);

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

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) return <img className="avatar" src={url} alt={name} referrerPolicy="no-referrer" />;
  return <div className="avatar avatar-fallback">{name.charAt(0).toUpperCase()}</div>;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [friendFlights, setFriendFlights] = useState<FriendFlight[]>([]);
  const [friendUsers, setFriendUsers] = useState<FriendUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [form, setForm] = useState({
    airlineIata: "",
    flightNumber: "",
    departureDate: "",
    originIata: "",
    destIata: "",
  });
  const [error, setError] = useState("");
  const [heroLive, setHeroLive] = useState<LivePosition | null>(null);
  const [heroTrack, setHeroTrack] = useState<[number, number][] | null>(null);
  const [heroMetars, setHeroMetars] = useState<Metar[]>([]);

  async function loadFlights() {
    const res = await fetch("/api/flights", { credentials: "include" });
    if (res.ok) setFlights((await res.json()).flights);
  }

  useEffect(() => {
    if (!user) return;
    loadFlights();
    fetch("/api/friends/flights", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setFriendFlights(d.flights ?? []))
        .catch(() => setFriendFlights([]));
    fetch("/api/friends", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setFriendUsers((d.friends ?? []).map((x: any) => x.user)))
        .catch(() => setFriendUsers([]));
  }, [user]);

  const today = todayUTC();
  const enRoute = flights.filter((f) => f.status === "ACTIVE" || f.status === "DIVERTED");
  const past = flights.filter(
      (f) =>
          f.status !== "ACTIVE" &&
          f.status !== "DIVERTED" &&
          (f.status === "LANDED" || dayOf(f.departureDate) < today)
  );
  const upcoming = flights
      .filter(
          (f) =>
              f.status !== "ACTIVE" &&
              f.status !== "DIVERTED" &&
              f.status !== "LANDED" &&
              dayOf(f.departureDate) >= today
      )
      .sort((a, b) => a.departureDate.localeCompare(b.departureDate));

  const ownHero = enRoute[0] ?? upcoming[0] ?? null;
  const friendHero = !ownHero
      ? friendFlights.find((f) => f.status === "ACTIVE" || f.status === "DIVERTED") ??
      [...friendFlights]
          .filter((f) => f.status !== "LANDED")
          .sort((a, b) => a.departureDate.localeCompare(b.departureDate))[0] ??
      null
      : null;
  const hero = ownHero ?? friendHero;
  const heroOwner = ownHero ? null : friendHero?.owner ?? null;
  const heroIsLive = hero != null && (hero.status === "ACTIVE" || hero.status === "DIVERTED");
  const otherEnRoute = enRoute.slice(1);
  const upcomingBelow = upcoming;

  const heroId = hero?.id ?? null;
  const heroStatus = hero?.status ?? null;
  useEffect(() => {
    setHeroLive(null);
    setHeroTrack(null);
    if (!heroId || (heroStatus !== "ACTIVE" && heroStatus !== "DIVERTED")) return;
    let cancelled = false;
    const load = () => {
      fetch(`/api/flights/${heroId}/live`, { credentials: "include" })
          .then((r) => r.json())
          .then((d) => {
            if (cancelled) return;
            setHeroLive(d.position ?? null);
            setHeroTrack(Array.isArray(d.track) ? d.track : null);
          })
          .catch(() => {});
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [heroId, heroStatus]);

  useEffect(() => {
    if (!hero) return;
    const ids = [toIcao(hero.originIata), toIcao(hero.destIata)].join(",");
    fetch(`/api/weather/metar?ids=${ids}`)
        .then((r) => r.json())
        .then((d) => setHeroMetars(Array.isArray(d.metars) ? d.metars : []))
        .catch(() => setHeroMetars([]));
  }, [hero?.id]);

  const friendCards = useMemo(() => {
    const byOwner = new Map<string, FriendFlight[]>();
    for (const f of friendFlights) {
      const list = byOwner.get(f.owner.id) ?? [];
      list.push(f);
      byOwner.set(f.owner.id, list);
    }
    return friendUsers.map((owner) => {
      const fs = (byOwner.get(owner.id) ?? []).slice().sort((a, b) => {
        const aLive = a.status === "ACTIVE" || a.status === "DIVERTED" ? 0 : 1;
        const bLive = b.status === "ACTIVE" || b.status === "DIVERTED" ? 0 : 1;
        if (aLive !== bLive) return aLive - bLive;
        return a.departureDate.localeCompare(b.departureDate);
      });
      return { owner, flights: fs };
    });
  }, [friendFlights, friendUsers]);

  async function addFlight(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/flights", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ airlineIata: "", flightNumber: "", departureDate: "", originIata: "", destIata: "" });
      setShowForm(false);
      loadFlights();
    } else {
      setError("Check the fields \u2014 pick an airline, flight number (3\u20134 digits), and airports (MCO/JFK).");
    }
  }

  if (loading) return <p>Loading\u2026</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
      <div>
        <div className="dash-head">
          <h1>Welcome, {user.name.split(" ")[0]}</h1>
          <div className="dash-actions">
            <button
                className="btn btn-ghost"
                disabled={refreshingAll}
                onClick={async () => {
                  setRefreshingAll(true);
                  try {
                    await fetch("/api/flights/refresh-all", {
                      method: "POST",
                      credentials: "include",
                    });
                    await loadFlights();
                  } finally {
                    setRefreshingAll(false);
                  }
                }}
            >
              {refreshingAll ? "Refreshing…" : "↻ Refresh"}
            </button>
            <button className="btn" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Close" : "+ Add flight"}
            </button>
          </div>
        </div>

        {showForm && (
            <section className="card">
              <form onSubmit={addFlight} className="flight-form">
                <select
                    value={form.airlineIata}
                    onChange={(e) => setForm({ ...form, airlineIata: e.target.value })}
                    required
                >
                  <option value="">Select airline\u2026</option>
                  {AIRLINES.map((a) => (
                      <option key={a.iata} value={a.iata}>
                        {a.name} ({a.iata})
                      </option>
                  ))}
                </select>
                <input
                    placeholder="Flight number"
                    value={form.flightNumber}
                    inputMode="numeric"
                    maxLength={4}
                    onChange={(e) => setForm({ ...form, flightNumber: e.target.value.replace(/\D/g, "") })}
                    required
                />
                <input
                    type="date"
                    value={form.departureDate}
                    onChange={(e) => setForm({ ...form, departureDate: e.target.value })}
                    required
                />
                <input
                    placeholder="From (MCO)"
                    value={form.originIata}
                    maxLength={3}
                    onChange={(e) => setForm({ ...form, originIata: e.target.value.toUpperCase() })}
                    required
                />
                <input
                    placeholder="To (JFK)"
                    value={form.destIata}
                    maxLength={3}
                    onChange={(e) => setForm({ ...form, destIata: e.target.value.toUpperCase() })}
                    required
                />
                <button className="btn" type="submit">Add</button>
              </form>
              <p className="hint">Flight numbers are usually 3 or 4 digits \u2014 just the number, no airline code.</p>
              {error && <p className="error">{error}</p>}
            </section>
        )}

        {hero ? (
            <section className="card hero">
              <div className="hero-title">
                <div>
                  {heroOwner && (
                      <span className="hero-owner">
                  <Avatar url={heroOwner.avatarUrl} name={heroOwner.name} />
                        {heroOwner.name.split(" ")[0]}&rsquo;s flight
                </span>
                  )}
                  <AirlineLogo iata={hero.airlineIata} height={38} />{" "}
                  <strong className="hero-flight">
                    {hero.airlineIata}{hero.flightNumber}
                  </strong>{" "}
                  <span className="muted">{airlineName(hero.airlineIata)}</span>
                  <span className={heroIsLive ? "pill pill-live" : "pill"}>
                {STATUS_LABELS[hero.status] ?? hero.status}
              </span>
                </div>
                <div className="hero-actions">
                  <Link className="link-btn map-link" to={`/flight/${hero.id}`}>details</Link>
                </div>
              </div>
              <FlightMapView flight={hero} metars={heroMetars} live={heroLive} track={heroTrack} height="42vh" />
              <div className="tile-grid hero-tiles">
                <div className="tile-box">
                  <span className="tile-label">Route</span>
                  <span className="tile-value">{hero.originIata} &rarr; {hero.destIata}</span>
                  {(hero.originCity || hero.destCity) && (
                      <span className="tile-sub">
                  {hero.originCity ?? hero.originIata} to {hero.destCity ?? hero.destIata}
                </span>
                  )}
                </div>
                <div className="tile-box">
                  <span className="tile-label">Date</span>
                  <span className="tile-value">
                {new Date(hero.departureDate).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </span>
                </div>
                {hero.schedDep && (
                    <div className="tile-box">
                      <span className="tile-label">Departs &middot; {hero.originIata}</span>
                      <span className="tile-value">
                  {time(heroIsLive && hero.actualDep ? hero.actualDep : hero.schedDep, hero.originTz)}
                </span>
                      <span className="tile-sub">
                  {heroIsLive && hero.actualDep && <s>{time(hero.schedDep, hero.originTz)} </s>}
                        {hero.terminal && <>Terminal {hero.terminal}</>}
                        {hero.gate && <> &middot; Gate {hero.gate}</>}
                </span>
                    </div>
                )}
                {hero.schedArr && (
                    <div className="tile-box">
                      <span className="tile-label">Arrives &middot; {hero.destIata}</span>
                      <span className="tile-value">
                  {time(heroIsLive && hero.actualArr ? hero.actualArr : hero.schedArr, hero.destTz)}
                </span>
                      <span className="tile-sub">
                  {heroIsLive && hero.actualArr && <s>{time(hero.schedArr, hero.destTz)} </s>}
                        {heroIsLive && hero.actualArr && hero.schedArr && (() => {
                          const d = minutesBetween(hero.actualArr, hero.schedArr);
                          if (d > 0) return <span className="delay">{d} min late</span>;
                          if (d < 0) return <span className="early">{-d} min early</span>;
                          return <span>on time</span>;
                        })()}
                </span>
                    </div>
                )}
              </div>
              {otherEnRoute.length > 0 && (
                  <p className="muted hint">
                    Also in the air:{" "}
                    {otherEnRoute.map((f, i) => (
                        <span key={f.id}>
                  {i > 0 && ", "}
                          <Link to={`/flight/${f.id}`}>{f.airlineIata}{f.flightNumber}</Link>
                </span>
                    ))}
                  </p>
              )}
            </section>
        ) : (
            <section className="card hero-empty">
              <div className="hero-empty-art" aria-hidden="true">{"✈"}</div>
              <h2>Where to next?</h2>
              <p className="muted">
                Add a flight to see it here with a live map, delays, and gates.
                Invite family and their trips will show up too.
              </p>
              <div className="hero-empty-actions">
                <button className="btn" onClick={() => setShowForm(true)}>+ Add a flight</button>
                <Link className="btn btn-ghost" to="/friends">Invite family</Link>
              </div>
            </section>
        )}

        <section>
          <h2 className="row-title">Friends</h2>
          {friendCards.length === 0 ? (
              <Link className="friend-card friend-card-invite" to="/friends">
                <div className="avatar avatar-fallback">+</div>
                <div className="friend-name">Add friends</div>
                <div className="friend-status muted">Follow each other's flights</div>
              </Link>
          ) : (
              <div className="friend-row">
                {friendCards.map(({ owner, flights: fs }) => (
                    <FriendCard key={owner.id} owner={owner} flights={fs} />
                ))}
              </div>
          )}
        </section>

        <FlightList
            title="Upcoming"
            flights={upcomingBelow}
            onChanged={loadFlights}
            emptyText="No upcoming flights."
        />
        <FlightList title="Past" flights={past} onChanged={loadFlights} emptyText="No past flights." />
      </div>
  );
}

function FlightList({
                      title,
                      flights,
                      onChanged,
                      emptyText,
                    }: {
  title: string;
  flights: Flight[];
  onChanged: () => void;
  emptyText: string;
}) {
  async function remove(id: string) {
    await fetch(`/api/flights/${id}`, { method: "DELETE", credentials: "include" });
    onChanged();
  }

  async function share(id: string) {
    const res = await fetch(`/api/flights/${id}/share`, {
      method: "POST",
      credentials: "include",
    });
    const d = await res.json();
    if (!d.shareToken) return alert("Could not create link");
    const url = `${window.location.origin}/s/${d.shareToken}`;
    await navigator.clipboard.writeText(url);
    alert(`Link copied:\n${url}\n\nAnyone with this link can view the flight.`);
  }

  const time = (iso: string, tz?: string | null) =>
      new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz ?? undefined,
        timeZoneName: "short",
      });

  const minutesBetween = (a: string, b: string) =>
      Math.round((new Date(a).getTime() - new Date(b).getTime()) / 60000);

  return (
      <section className="card">
        <h2>{title}</h2>
        {flights.length === 0 && <p className="muted">{emptyText}</p>}
        <ul className="flight-list">
          {flights.map((f) => (
              <li key={f.id} className="flight-tile">
                {(() => {
                  const live = f.status === "ACTIVE" || f.status === "DIVERTED" || f.status === "LANDED";
                  return (
                      <>
                        <div className="tile-head">
                          <div className="tile-id">
                            <AirlineLogo iata={f.airlineIata} />
                            <strong>{f.airlineIata}{f.flightNumber}</strong>
                            <span className="muted">{airlineName(f.airlineIata)}</span>
                            <span className={f.status === "ACTIVE" ? "pill pill-live" : "pill"}>
                        {STATUS_LABELS[f.status] ?? f.status}
                      </span>
                          </div>
                          <div className="tile-actions">
                            <Link className="link-btn map-link" to={`/flight/${f.id}`}>map</Link>
                            <button className="link-btn map-link" onClick={() => share(f.id)}>share</button>
                            <button className="link-btn" onClick={() => remove(f.id)}>remove</button>
                          </div>
                        </div>
                        <div className="tile-grid">
                          <div className="tile-box">
                            <span className="tile-label">Route</span>
                            <span className="tile-value">{f.originIata} &rarr; {f.destIata}</span>
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
                                <span className="tile-label">Departs</span>
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
                                <span className="tile-label">Arrives</span>
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
                      </>
                  );
                })()}
              </li>
          ))}
        </ul>
      </section>
  );
}
