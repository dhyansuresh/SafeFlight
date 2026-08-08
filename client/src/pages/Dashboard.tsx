import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../App";
import { Link } from "react-router-dom";
import { AIRLINES, airlineName } from "../lib/arlines";

type FriendFlight = Flight & { owner: { id: string; name: string } };

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
};

// Database enum -> friendly label. The DB keeps ACTIVE; users read "En route".
const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  ACTIVE: "En route",
  LANDED: "Landed",
  CANCELLED: "Cancelled",
  DIVERTED: "Diverted",
  UNKNOWN: "—",
};

// departureDate arrives as "2026-08-07T00:00:00.000Z"
const dayOf = (iso: string) => iso.slice(0, 10);
const todayUTC = () => new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [friendFlights, setFriendFlights] = useState<FriendFlight[]>([]);
  const [form, setForm] = useState({
    airlineIata: "",
    flightNumber: "",
    departureDate: "",
    originIata: "",
    destIata: "",
  });
  const [error, setError] = useState("");

  async function loadFlights() {
    const res = await fetch("/api/flights", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setFlights(data.flights);
    }
  }

  useEffect(() => {
    if (!user) return;
    loadFlights();
    fetch("/api/friends/flights", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setFriendFlights(d.flights ?? []))
      .catch(() => setFriendFlights([]));
  }, [user]);

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
      loadFlights();
    } else {
      setError("Check the fields — pick an airline, flight number (3–4 digits), and airports (MCO/JFK).");
    }
  }

  if (loading) return <p>Loading…</p>;
  if (!user)
    return (
      <div className="card center">
        <p>
          <Link to="/login">Sign in</Link> to start tracking flights.
        </p>
      </div>
    );

  // Status wins when we have it otherwise fall back to the calendar date.
  const today = todayUTC();
  const enRoute = flights.filter((f) => f.status === "ACTIVE" || f.status === "DIVERTED");
  const past = flights.filter(
    (f) =>
      f.status !== "ACTIVE" &&
      f.status !== "DIVERTED" &&
      (f.status === "LANDED" || dayOf(f.departureDate) < today)
  );
  const upcoming = flights.filter(
    (f) =>
      f.status !== "ACTIVE" &&
      f.status !== "DIVERTED" &&
      f.status !== "LANDED" &&
      dayOf(f.departureDate) >= today
  );

  return (
    <div>
      <h1>Welcome, {user.name.split(" ")[0]}</h1>

      <section className="card">
        <h2>Add a flight</h2>
        <form onSubmit={addFlight} className="flight-form">
          <select
            value={form.airlineIata}
            onChange={(e) => setForm({ ...form, airlineIata: e.target.value })}
            required
          >
            <option value="">Select airline…</option>
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
            onChange={(e) =>
              setForm({ ...form, flightNumber: e.target.value.replace(/\D/g, "") })
            }
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
        <p className="hint">Flight numbers are usually 3 or 4 digits — enter just the number, no airline code.</p>
        {error && <p className="error">{error}</p>}
      </section>

      {friendFlights.length > 0 && (
        <section className="card">
          <h2>Friends&rsquo; flights</h2>
          <ul className="flight-list">
            {friendFlights.map((f) => (
              <li key={f.id}>
                <div>
                  <span className="muted">{f.owner.name}</span>{" "}
                  &middot; <strong>{f.airlineIata}{f.flightNumber}</strong>{" "}
                  &middot; {f.originIata} &rarr; {f.destIata}{" "}
                  &middot; {STATUS_LABELS[f.status] ?? f.status}
                  <Link className="link-btn map-link" to={`/flight/${f.id}`}>view</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FlightList title="En route" flights={enRoute} onChanged={loadFlights} emptyText="No flights in the air right now." />
      <FlightList title="Upcoming" flights={upcoming} onChanged={loadFlights} emptyText="No upcoming flights." />
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

  async function edit(id: string) {
    const destIata = prompt("New destination airport (3 letters, e.g. LAX):");
    if (!destIata) return;
    await fetch(`/api/flights/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destIata: destIata.toUpperCase() }),
    });
    onChanged();
  }

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const minutesBetween = (a: string, b: string) =>
    Math.round((new Date(a).getTime() - new Date(b).getTime()) / 60000);

  return (
    <section className="card">
      <h2>{title}</h2>
      {flights.length === 0 && <p className="muted">{emptyText}</p>}
      <ul className="flight-list">
        {flights.map((f) => (
          <li key={f.id}>
            <div>
              <strong>{f.airlineIata}{f.flightNumber}</strong>{" "}
              <span className="muted">{airlineName(f.airlineIata)}</span>{" "}
              · {f.originIata} → {f.destIata} ·{" "}
              {new Date(f.departureDate).toLocaleDateString([], { timeZone: "UTC" })} ·{" "}
              {STATUS_LABELS[f.status] ?? f.status}
              <Link className="link-btn map-link" to={`/flight/${f.id}`}>map</Link>
              <button className="link-btn" onClick={() => remove(f.id)}>remove</button>
              <button className="link-btn" onClick={() => edit(f.id)}>edit</button>
            </div>

            {f.schedDep && (
              <div className="muted detail">
                Departs {time(f.schedDep)}
                {f.terminal && ` · Terminal ${f.terminal}`}
                {f.gate && ` · Gate ${f.gate}`}
                {f.actualDep &&
                  (() => {
                    const d = minutesBetween(f.actualDep, f.schedDep!);
                    if (d > 0) return <span className="delay"> · left {d} min late</span>;
                    if (d < 0) return <span className="early"> · left {-d} min early</span>;
                    return <span> · left on time</span>;
                  })()}
              </div>
            )}

            {f.schedArr && (
              <div className="muted detail">
                Arrives {time(f.schedArr)}
                {f.actualArr &&
                  (() => {
                    const d = minutesBetween(f.actualArr, f.schedArr!);
                    if (d > 0) return <span className="delay"> · {d} min late</span>;
                    if (d < 0) return <span className="early"> · {-d} min early</span>;
                    return <span> · on time</span>;
                  })()}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
