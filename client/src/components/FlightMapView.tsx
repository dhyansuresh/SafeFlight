import { useEffect } from "react";
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

export type MappableFlight = {
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

export type LivePosition = {
  icao24: string;
  callsign: string;
  lat: number;
  lon: number;
  altitudeM: number | null;
  headingDeg: number | null;
  velocityMs: number | null;
  onGround: boolean;
};

export type Metar = {
  icaoId: string;
  temp?: number;
  wspd?: number;
  visib?: string | number;
  fltCat?: string;
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

export const toIcao = (iata: string) => `K${iata}`;

export const hasCoords = (f: MappableFlight) =>
  f.originLat != null && f.originLon != null && f.destLat != null && f.destLon != null;

function estimatedPosition(
  f: MappableFlight,
  route: [number, number][]
): [number, number] | null {
  const dep = f.actualDep ?? f.schedDep;
  const arr = f.actualArr ?? f.schedArr;
  if (!dep || !arr) return null;

  const start = new Date(dep).getTime();
  const end = new Date(arr).getTime();
  const now = Date.now();
  if (now <= start || now >= end || end <= start) return null;

  const fraction = (now - start) / (end - start);
  const idx = Math.min(
    route.length - 1,
    Math.max(0, Math.round(fraction * (route.length - 1)))
  );
  return route[idx];
}

// The glyph points up (north) by default, so rotate it to the heading.
const makePlaneIcon = (headingDeg: number | null, live: boolean) =>
  L.divIcon({
    className: "plane-marker",
    html:
      `<div style="font-size:24px;line-height:24px;` +
      `transform:rotate(${(headingDeg ?? 0) - 45}deg);` +
      `color:${live ? "#1565c0" : "#888"}">&#9992;</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
  }, [map, points]);
  return null;
}

function WeatherDot({
  iata,
  lat,
  lon,
  metars,
}: {
  iata: string;
  lat: number;
  lon: number;
  metars: Metar[];
}) {
  const m = metars.find((x) => x.icaoId === toIcao(iata));
  const color = CAT_COLORS[m?.fltCat ?? ""] ?? "#757575";
  return (
    <CircleMarker
      center={[lat, lon]}
      radius={9}
      pathOptions={{ color, fillColor: color, fillOpacity: 0.85 }}
    >
      <Popup>
        <strong>{iata}</strong>
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
}

export default function FlightMapView({
  flight,
  metars = [],
  live = null,
  track = null,
  height = "60vh",
}: {
  flight: MappableFlight;
  metars?: Metar[];
  live?: LivePosition | null;
  track?: [number, number][] | null;
  height?: string;
}) {
  if (!hasCoords(flight)) {
    return (
      <p className="muted">
        This flight has no map data yet. It appears once the flight has been
        polled for live information.
      </p>
    );
  }

  const points = greatCirclePoints(
    flight.originLat!,
    flight.originLon!,
    flight.destLat!,
    flight.destLon!,
    64
  );
  const isActive = flight.status === "ACTIVE";
  // Real ADS-B position wins; fall back to the time-based estimate.
  const pos: [number, number] | null = live
    ? [live.lat, live.lon]
    : isActive
    ? estimatedPosition(flight, points)
    : null;
  const hasTrack = Boolean(track && track.length > 1);

  return (
    <MapContainer center={points[0]} zoom={5} style={{ height, width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds points={hasTrack ? [...points, ...track!] : points} />

      <Polyline
        positions={points}
        pathOptions={{
          color: hasTrack ? "#bbb" : isActive ? "#1565c0" : "#888",
          weight: hasTrack ? 1 : isActive ? 3 : 2,
          dashArray: hasTrack || !isActive ? "6 6" : undefined,
        }}
      />

      {hasTrack && (
        <Polyline
          positions={track!}
          pathOptions={{ color: "#2e7d32", weight: 3 }}
        />
      )}

      {pos && (
        <Marker position={pos} icon={makePlaneIcon(live?.headingDeg ?? null, Boolean(live))}>
          <Popup>
            <strong>
              {flight.airlineIata}
              {flight.flightNumber}
            </strong>
            {live ? (
              <div>
                <div>
                  {live.altitudeM != null
                    ? `${Math.round(live.altitudeM * 3.281).toLocaleString()} ft`
                    : "altitude n/a"}
                </div>
                <div>
                  {live.velocityMs != null
                    ? `${Math.round(live.velocityMs * 1.944)} kt`
                    : "speed n/a"}
                </div>
                <div className="muted">Live position</div>
              </div>
            ) : (
              <div className="muted">Estimated position</div>
            )}
          </Popup>
        </Marker>
      )}

      <WeatherDot
        iata={flight.originIata}
        lat={flight.originLat!}
        lon={flight.originLon!}
        metars={metars}
      />
      <WeatherDot
        iata={flight.destIata}
        lat={flight.destLat!}
        lon={flight.destLon!}
        metars={metars}
      />
    </MapContainer>
  );
}
