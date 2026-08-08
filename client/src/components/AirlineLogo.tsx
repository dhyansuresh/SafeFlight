import { useState } from "react";

export default function AirlineLogo({ iata, height = 30 }: { iata: string; height?: number }) {
    const [failed, setFailed] = useState(false);
    if (failed) return null;
    const width = Math.round(height * 2.5);
    return (
        <img
            className="airline-logo"
            src={`https://pics.avs.io/${width * 2}/${height * 2}/${iata}.png`}
            style={{ height, width: "auto", maxWidth: width }}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
}