import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from "react-leaflet";
import { greatCirclePoints } from "../lib/geo";

// Demo route (MCO -> JFK) until flights carry airport coordinates (Phase 4).
const MCO = { icao: "KMCO", name: "Orlando Intl", lat: 28.4294, lon: -81.309 };
const JFK = { icao: "KJFK", name: "John F. Kennedy Intl", lat: 40.6413, lon: -73.7781 };

type Metar = {
  icaoId: string;
  temp?: number;      // °C
  wspd?: number;      // knots
  visib?: string | number;
  fltCat?: string;    // VFR / MVFR / IFR / LIFR
  rawOb?: string;
};

const CAT_COLORS: Record<string, string> = {
  VFR: "#2e7d32",   // green — good conditions
  MVFR: "#1565c0",  // blue
  IFR: "#c62828",   // red
  LIFR: "#6a1b9a",  // magenta — worst
};

export default function FlightMap() {
  const [metars, setMetars] = useState<Metar[]>([]);
  const airports = [MCO, JFK];

  useEffect(() => {
    fetch(`/api/weather/metar?ids=${airports.map((a) => a.icao).join(",")}`)
      .then((r) => r.json())
      .then((d) => setMetars(Array.isArray(d.metars) ? d.metars : []))
      .catch(() => setMetars([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const route = greatCirclePoints(MCO.lat, MCO.lon, JFK.lat, JFK.lon, 64);

  return (
    <div className="map-wrap">
      <MapContainer center={[34.5, -77.5]} zoom={5} style={{ height: "70vh", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Polyline positions={route} pathOptions={{ color: "#333", weight: 2, dashArray: "6 6" }} />

        {airports.map((a) => {
          const m = metars.find((x) => x.icaoId === a.icao);
          const color = CAT_COLORS[m?.fltCat ?? ""] ?? "#757575";
          return (
            <CircleMarker key={a.icao} center={[a.lat, a.lon]} radius={9}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85 }}>
              <Popup>
                <strong>{a.name} ({a.icao})</strong>
                {m ? (
                  <div>
                    <div>Category: {m.fltCat ?? "n/a"}</div>
                    <div>Temp: {m.temp ?? "?"}°C · Wind: {m.wspd ?? "?"} kt</div>
                    <div>Visibility: {String(m.visib ?? "?")} mi</div>
                    <code style={{ fontSize: 11 }}>{m.rawOb}</code>
                  </div>
                ) : (
                  <div>Weather loading / unavailable</div>
                )}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <p className="muted">
        Marker colors show flight category from aviationweather.gov METARs:
        green VFR, blue MVFR, red IFR, purple LIFR.
      </p>
    </div>
  );
}
