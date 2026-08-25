"use client";

import { useState } from "react";
import { US_MAP_VIEWBOX, US_STATE_PATHS, US_STATE_LABEL_POS, DC_MARKER } from "@/lib/us-map-paths";
import { stateNameForCode } from "@/lib/us-states";

type Props = {
  /** Called with the 2-letter state code when a state is activated (click or Enter/Space). */
  onSelect: (code: string) => void;
};

/** Clickable illustrated map of the US — lets customers click any state to
 * jump to its festivals/events page. Path data lives in lib/us-map-paths.ts
 * (framework-agnostic, shared with the mobile app's equivalent map). */
export default function USAMapSelector({ onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  function activate(code: string) {
    onSelect(code);
  }

  function handleKeyDown(e: React.KeyboardEvent, code: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate(code);
    }
  }

  return (
    <svg
      viewBox={US_MAP_VIEWBOX}
      role="group"
      aria-label="Map of the United States — select a state"
      className="w-full h-auto select-none"
    >
      {Object.entries(US_STATE_PATHS).map(([code, d]) => {
        const isHovered = hovered === code;
        return (
          <path
            key={code}
            d={d}
            role="button"
            tabIndex={0}
            aria-label={stateNameForCode(code) ?? code}
            onClick={() => activate(code)}
            onKeyDown={(e) => handleKeyDown(e, code)}
            onMouseEnter={() => setHovered(code)}
            onMouseLeave={() => setHovered((c) => (c === code ? null : c))}
            fill={isHovered ? "#E8481C" : "#D3D3D3"}
            stroke="#ffffff"
            strokeWidth={1}
            style={{ cursor: "pointer", transition: "fill 0.12s ease" }}
          />
        );
      })}
      {/* DC — too small at this scale for a path, rendered as a dot */}
      <circle
        cx={DC_MARKER.cx}
        cy={DC_MARKER.cy}
        r={DC_MARKER.r}
        role="button"
        tabIndex={0}
        aria-label={stateNameForCode("DC") ?? "Washington, D.C."}
        onClick={() => activate("DC")}
        onKeyDown={(e) => handleKeyDown(e, "DC")}
        onMouseEnter={() => setHovered("DC")}
        onMouseLeave={() => setHovered((c) => (c === "DC" ? null : c))}
        fill={hovered === "DC" ? "#E8481C" : "#888888"}
        stroke="#ffffff"
        strokeWidth={1.5}
        style={{ cursor: "pointer", transition: "fill 0.12s ease" }}
      />

      {/* State abbreviation labels — purely decorative, clicks pass through to the path beneath */}
      {Object.entries(US_STATE_LABEL_POS).map(([code, pos]) => (
        <text
          key={code}
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fontWeight={700}
          fill={hovered === code ? "#ffffff" : "#5a5a5a"}
          pointerEvents="none"
          style={{ userSelect: "none" }}
        >
          {code}
        </text>
      ))}
    </svg>
  );
}
