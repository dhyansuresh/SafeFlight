import { useState } from "react";
import { Link } from "react-router-dom";

type Owner = { id: string; name: string; avatarUrl: string | null };

type MiniFlight = {
  id: string;
  airlineIata: string;
  flightNumber: string;
  departureDate: string;
  originIata: string;
  destIata: string;
  originCity: string | null;
  destCity: string | null;
  status: string;
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  ACTIVE: "En route",
  LANDED: "Landed",
  CANCELLED: "Cancelled",
  DIVERTED: "Diverted",
  UNKNOWN: "\u2014",
};

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) return <img className="avatar" src={url} alt={name} referrerPolicy="no-referrer" />;
  return <div className="avatar avatar-fallback">{name.charAt(0).toUpperCase()}</div>;
}

export default function FriendCard({
  owner,
  flights,
}: {
  owner: Owner;
  flights: MiniFlight[];
}) {
  const [idx, setIdx] = useState(0);
  const f = flights[idx] ?? null;
  const many = flights.length > 1;

  return (
    <div className="friend-card">
      <Link className="friend-identity" to={`/friends/${owner.id}`}>
        <Avatar url={owner.avatarUrl} name={owner.name} />
        <div className="friend-name">{owner.name.split(" ")[0]}</div>
      </Link>

      {f ? (
        <>
          <Link className="friend-flight-link" to={`/flight/${f.id}`}>
            <div className="friend-flight">
              {f.airlineIata}
              {f.flightNumber}
            </div>
            <div className="friend-route">
              {f.originCity ?? f.originIata} &rarr; {f.destCity ?? f.destIata}
            </div>
            <div className="friend-date">
              {new Date(f.departureDate).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
            </div>
            <div className={f.status === "ACTIVE" ? "friend-status live" : "friend-status"}>
              {STATUS_LABELS[f.status] ?? f.status}
            </div>
          </Link>

          {many && (
            <div className="friend-pager">
              <button
                aria-label="Previous flight"
                onClick={() => setIdx((i) => (i - 1 + flights.length) % flights.length)}
              >
                &#8249;
              </button>
              <span>
                {idx + 1}/{flights.length}
              </span>
              <button
                aria-label="Next flight"
                onClick={() => setIdx((i) => (i + 1) % flights.length)}
              >
                &#8250;
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="friend-status muted">No trips</div>
      )}
    </div>
  );
}
