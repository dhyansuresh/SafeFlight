import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../App";

type Inviter = { name: string; avatarUrl: string | null };

export default function Join() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [inviter, setInviter] = useState<Inviter | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    sessionStorage.setItem("safeflight_invite", token);
    fetch(`/api/invite/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setInviter(d.inviter))
      .catch(() => setNotFound(true));
  }, [token]);

  useEffect(() => {
    if (!user || !token) return;
    fetch(`/api/invite/${token}/accept`, { method: "POST", credentials: "include" })
      .then(() => {
        sessionStorage.removeItem("safeflight_invite");
        navigate("/");
      })
      .catch(() => navigate("/"));
  }, [user, token, navigate]);

  if (notFound)
    return (
      <div className="card center">
        <p>This invite link is invalid or has been revoked.</p>
      </div>
    );
  if (loading || !inviter) return <p>Loading&hellip;</p>;

  return (
    <div className="card center join-card">
      {inviter.avatarUrl ? (
        <img className="avatar avatar-lg" src={inviter.avatarUrl} alt={inviter.name} referrerPolicy="no-referrer" />
      ) : (
        <div className="avatar avatar-lg avatar-fallback">{inviter.name.charAt(0)}</div>
      )}
      <h1>{inviter.name} invited you to SafeFlight</h1>
      <p className="muted">
        Sign in with Google and you&rsquo;ll automatically be added as friends,
        so you can follow each other&rsquo;s flights.
      </p>
      <a className="btn" href="/api/auth/google">Continue with Google</a>
    </div>
  );
}
