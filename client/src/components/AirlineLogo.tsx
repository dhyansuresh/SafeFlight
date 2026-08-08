import { useState } from "react";

export default function AirlineLogo({ iata, size = 28 }: { iata: string; size?: number }) {
    const [failed, setFailed] = useState(false);
    if (failed) return null;
    return (
        <img
            className="airline-logo"
            src={`https://pics.avs.io/${size * 2}/${size * 2}/${iata}.png`}
            width={size}
            height={size}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
}