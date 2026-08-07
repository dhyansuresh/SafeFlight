import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { greatCirclePoints } from "../lib/geo";
import { useAuth } from "../App";
import { Link } from "react-router-dom";

type Flight = {
  id: string;
  airlineIata: string;
  flightNumber: string;
  originIata: string;
  destIata: string;
  status: string;
  schedDep: string | null;
  schedArr: string | null;
  actualDep: string | null;
  actualArr: string | null;
  originLat: number | null;
  originLon: number | null;
  destLat: number | null;
  destLon: number | null;
};

type Metar = {
  icaoId: string;
  temp?: number;
  wspd?: number;
  visib?: string | number;
  fltCat?: string;
  rawOb?: string;
};

const CAT_COLORS: Record<string, string> = {
  VFR: "#2e7d32",
  MVFR: "#1565c0",
  IFR: "#c62828",
  LIFR: "#6a1b9a",
};

const CAT_LABELS: Record<string, string> = {
  VFR: "Clear",
  MVFR: "Some clouds",
  IFR: "Low visibility",
  LIFR: "Very poor visibility",
};

// aviationweather.gov uses ICAO.
const toIcao = (iata: string) => `K${iata}`;

const hasCoords = (f: Flight) =>
    f.originLat != null && f.originLon != null && f.destLat != null && f.destLon != null;

function estimatedPosition(f: Flight, route: [number, number][]): [number, number] | null {
  const dep = f.actualDep ?? f.schedDep;
  const arr = f.actualArr ?? f.schedArr;
  if (!dep || !arr) return null;

  const start = new Date(dep).getTime();
  const end = new Date(arr).getTime();
  const now = Date.now();
  if (now <= start || now >= end || end <= start) return null;

  const fraction = (now - start) / (end - start);
  const idx = Math.min(route.length - 1, Math.max(0, Math.round(fraction * (route.length - 1))));
  return route[idx];
}

const planeIcon = L.divIcon({
  className: "plane-marker",
  html: '<div style="font-size:20px;line-height:20px">&#9992;</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export default function FlightMap() {
  const { user, loading } = useAuth();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [metars, setMetars] = useState<Metar[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/flights", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setFlights(d.flights ?? []))
        .catch(() => setFlights([]));
  }, [user]);

  const drawable = flights.filter(hasCoords);

  const airports = Array.from(
      new Map(
          drawable.flatMap((f) => [
            [f.originIata, { iata: f.originIata, lat: f.originLat!, lon: f.originLon! }] as const,
            [f.destIata, { iata: f.destIata, lat: f.destLat!, lon: f.destLon! }] as const,
          ])
      ).values()
  );

  const airportKey = airports.map((a) => a.iata).join(",");

  useEffect(() => {
    if (!airportKey) return;
    const ids = airportKey.split(",").map(toIcao).join(",");
    fetch(`/api/weather/metar?ids=${ids}`)
        .then((r) => r.json())
        .then((d) => setMetars(Array.isArray(d.metars) ? d.metars : []))
        .catch(() => setMetars([]));
  }, [airportKey]);

  if (loading) return <p>Loading…</p>;
  if (!user)
    return (
        <div className="card center">
          <p>
            <Link to="/login">Sign in</Link> to see your flights on the map.
          </p>
        </div>
    );

  const routes = drawable.map((f) => ({
    flight: f,
    points: greatCirclePoints(f.originLat!, f.originLon!, f.destLat!, f.destLon!, 64),
  }));

  const allPoints = routes.flatMap((r) => r.points);

  return (
      <div className="map-wrap">
        <h1>Flight map</h1>

        {drawable.length === 0 && (
            <p className="muted">
              No mapped flights yet. Flights appear here once they have been polled
              for live data.
            </p>
        )}

        <MapContainer center={[35, -90]} zoom={4} style={{ height: "70vh", width: "100%" }}>
          <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds points={allPoints} />

          {routes.map(({ flight: f, points }) => {
            const isActive = f.status === "ACTIVE";
            const pos = isActive ? estimatedPosition(f, points) : null;
            return (
                <div key={f.id}>
                  <Polyline
                      positions={points}
                      pathOptions={{
                        color: isActive ? "#1565c0" : "#888",
                        weight: isActive ? 3 : 2,
                        dashArray: isActive ? undefined : "6 6",
                      }}
                  />
                  {pos && (
                      <Marker position={pos} icon={planeIcon}>
                        <Popup>
                          <strong>
                            {f.airlineIata}
                            {f.flightNumber}
                          </strong>
                          <div>
                            {f.originIata} &rarr; {f.destIata}
                          </div>
                          <div className="muted">Estimated position</div>
                        </Popup>
                      </Marker>
                  )}
                </div>
            );
          })}

          {airports.map((a) => {
            const m = metars.find((x) => x.icaoId === toIcao(a.iata));
            const color = CAT_COLORS[m?.fltCat ?? ""] ?? "#757575";
            return (
                <CircleMarker
                    key={a.iata}
                    center={[a.lat, a.lon]}
                    radius={8}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.85 }}
                >
                  <Popup>
                    <strong>{a.iata}</strong>
                    {m ? (
                        <div>
                          <div>
                            {CAT_LABELS[m.fltCat ?? ""] ?? "Unknown"}{" "}
                            {m.fltCat && <span className="muted">({m.fltCat})</span>}
                          </div>
                          <div>
                            {m.temp ?? "?"}&deg;C &middot; wind {m.wspd ?? "?"} kt
                          </div>
                          <div>Visibility {String(m.visib ?? "?")} mi</div>
                        </div>
                    ) : (
                        <div className="muted">No weather report</div>
                    )}
                  </Popup>
                </CircleMarker>
            );
          })}
        </MapContainer>

        <p className="muted hint">
          Solid blue routes are in the air. Airport dots show current flying conditions:
          green is clear, blue some clouds, red low visibility, purple very poor.
          Aircraft positions are estimated from departure and arrival times.
        </p>
      </div>
  );
}