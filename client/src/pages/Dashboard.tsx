import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../App";
import { Link } from "react-router-dom";

type Flight = {
  id: string;
  airlineIata: string;
  flightNumber: string;
  departureDate: string;
  originIata: string;
  destIata: string;
  status: string;
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [flights, setFlights] = useState<Flight[]>([]);
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
    if (user) loadFlights();
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
      setError("Check the fields — airline (DL), flight # (1234), airports (MCO/JFK).");
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

  const now = new Date();
  const upcoming = flights.filter((f) => new Date(f.departureDate) >= now);
  const past = flights.filter((f) => new Date(f.departureDate) < now);

  return (
    <div>
      <h1>Welcome, {user.name.split(" ")[0]}</h1>

      <section className="card">
        <h2>Add a flight</h2>
        <form onSubmit={addFlight} className="flight-form">
          <input placeholder="Airline (DL)" value={form.airlineIata} maxLength={3}
            onChange={(e) => setForm({ ...form, airlineIata: e.target.value.toUpperCase() })} required />
          <input placeholder="Flight # (1234)" value={form.flightNumber} maxLength={5}
            onChange={(e) => setForm({ ...form, flightNumber: e.target.value })} required />
          <input type="date" value={form.departureDate}
            onChange={(e) => setForm({ ...form, departureDate: e.target.value })} required />
          <input placeholder="From (MCO)" value={form.originIata} maxLength={3}
            onChange={(e) => setForm({ ...form, originIata: e.target.value.toUpperCase() })} required />
          <input placeholder="To (JFK)" value={form.destIata} maxLength={3}
            onChange={(e) => setForm({ ...form, destIata: e.target.value.toUpperCase() })} required />
          <button className="btn" type="submit">Add</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <FlightList title="Upcoming" flights={upcoming} onChanged={loadFlights} />
      <FlightList title="Past" flights={past} onChanged={loadFlights} />
    </div>
  );
}

function FlightList({ title, flights, onChanged }: { title: string; flights: Flight[]; onChanged: () => void }) {
  async function remove(id: string) {
    await fetch(`/api/flights/${id}`, { method: "DELETE", credentials: "include" });
    onChanged();
  }
  return (
    <section className="card">
      <h2>{title}</h2>
      {flights.length === 0 && <p className="muted">No flights yet.</p>}
      <ul className="flight-list">
        {flights.map((f) => (
          <li key={f.id}>
            <strong>{f.airlineIata}{f.flightNumber}</strong>{" "}
            {f.originIata} → {f.destIata} ·{" "}
            {new Date(f.departureDate).toLocaleDateString()} · {f.status}
            <button className="link-btn" onClick={() => remove(f.id)}>remove</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
