import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../App";

type PublicUser = { id: string; name: string; email: string; avatarUrl: string | null };
type FriendRow = { friendshipId: string; user: PublicUser };
type RequestRow = { id: string; requester: PublicUser };

export default function Friends() {
  const { user, loading } = useAuth();
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<PublicUser | null>(null);
  const [message, setMessage] = useState("");

  async function loadAll() {
    const [fr, rq] = await Promise.all([
      fetch("/api/friends", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/friends/requests", { credentials: "include" }).then((r) => r.json()),
    ]);
    setFriends(fr.friends ?? []);
    setRequests(rq.requests ?? []);
  }

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  async function search(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setFound(null);
    const res = await fetch(
      `/api/friends/search?email=${encodeURIComponent(email.trim())}`,
      { credentials: "include" }
    );
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Search failed");
    } else if (!data.user) {
      setMessage("No SafeFlight user with that email.");
    } else {
      setFound(data.user);
    }
  }

  async function sendRequest(userId: string) {
    setMessage("");
    const res = await fetch("/api/friends/request", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Could not send request");
    } else if (data.autoAccepted) {
      setMessage("They had already invited you — you're now friends!");
    } else {
      setMessage("Request sent.");
    }
    setFound(null);
    setEmail("");
    loadAll();
  }

  async function respond(id: string, action: "accept" | "decline") {
    await fetch(`/api/friends/requests/${id}/${action}`, {
      method: "POST",
      credentials: "include",
    });
    loadAll();
  }

  async function unfriend(friendshipId: string, name: string) {
    if (!confirm(`Remove ${name} from your friends?`)) return;
    await fetch(`/api/friends/${friendshipId}`, {
      method: "DELETE",
      credentials: "include",
    });
    loadAll();
  }

  if (loading) return <p>Loading&hellip;</p>;
  if (!user)
    return (
      <div className="card center">
        <p>
          <Link to="/login">Sign in</Link> to manage friends.
        </p>
      </div>
    );

  return (
    <div>
      <h1>Friends &amp; family</h1>

      <section className="card">
        <h2>Add someone</h2>
        <p className="muted">
          Enter their full email address — the one they use to sign in to
          SafeFlight.
        </p>
        <form onSubmit={search} className="flight-form">
          <input
            type="email"
            placeholder="their-email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ minWidth: "260px" }}
          />
          <button className="btn" type="submit">Find</button>
        </form>
        {found && (
          <p>
            Found <strong>{found.name}</strong> ({found.email}){" "}
            <button className="btn" onClick={() => sendRequest(found.id)}>
              Send request
            </button>
          </p>
        )}
        {message && <p className="hint">{message}</p>}
      </section>

      {requests.length > 0 && (
        <section className="card">
          <h2>Requests</h2>
          <ul className="flight-list">
            {requests.map((r) => (
              <li key={r.id}>
                <strong>{r.requester.name}</strong>{" "}
                <span className="muted">{r.requester.email}</span>
                <button className="link-btn map-link" onClick={() => respond(r.id, "accept")}>
                  accept
                </button>
                <button className="link-btn" onClick={() => respond(r.id, "decline")}>
                  decline
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Your friends</h2>
        {friends.length === 0 && (
          <p className="muted">
            No friends yet. Add someone above to follow each other's flights.
          </p>
        )}
        <ul className="flight-list">
          {friends.map((f) => (
            <li key={f.friendshipId}>
              <strong>{f.user.name}</strong>{" "}
              <span className="muted">{f.user.email}</span>
              <button
                className="link-btn"
                onClick={() => unfriend(f.friendshipId, f.user.name)}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
