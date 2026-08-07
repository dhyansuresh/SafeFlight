export type Airline = { iata: string; name: string };

export const AIRLINES: Airline[] = [
    { iata: "AS", name: "Alaska Airlines" },
    { iata: "G4", name: "Allegiant Air" },
    { iata: "AA", name: "American Airlines" },
    { iata: "MX", name: "Breeze Airways" },
    { iata: "DL", name: "Delta Air Lines" },
    { iata: "9E", name: "Endeavor Air" },
    { iata: "MQ", name: "Envoy Air" },
    { iata: "F9", name: "Frontier Airlines" },
    { iata: "HA", name: "Hawaiian Airlines" },
    { iata: "B6", name: "JetBlue Airways" },
    { iata: "PT", name: "Piedmont Airlines" },
    { iata: "OH", name: "PSA Airlines" },
    { iata: "YX", name: "Republic Airways" },
    { iata: "OO", name: "SkyWest Airlines" },
    { iata: "WN/SWA", name: "Southwest Airlines" },
    { iata: "NK", name: "Spirit Airlines" },
    { iata: "SY", name: "Sun Country Airlines" },
    { iata: "UA", name: "United Airlines" },
    { iata: "XP", name: "Avelo Airlines" },
];

// Quick lookup:
export const airlineName = (iata: string): string =>
    AIRLINES.find((a) => a.iata === iata)?.name ?? iata;