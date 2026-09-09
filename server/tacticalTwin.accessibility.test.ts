import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TacticalTwinMap } from "../client/src/components/tactical-twin/TacticalTwinMap";
import { buildDefaultBallPath, buildDefaultTwinPlayers } from "../shared/tacticalTwin";

describe("Tactical Twin accessibility contract", () => {
  it("renders all 22 players as labeled keyboard-focusable controls", () => {
    const players = buildDefaultTwinPlayers("Shotgun 2x2", "pass", "Y");
    const html = renderToStaticMarkup(createElement(TacticalTwinMap, {
      players,
      ballPath: buildDefaultBallPath(players, "pass"),
      markers: [],
      progress: 0,
      selectedPlayerId: players[0]?.id ?? null,
      tool: "select",
      onSelectPlayer: vi.fn(),
      onMovePlayer: vi.fn(),
      onAddRoutePoint: vi.fn(),
      onAddBallPoint: vi.fn(),
      onAddMarker: vi.fn(),
    }));

    expect(html).toContain('aria-label="Editable Tactical Twin football field"');
    expect(html.match(/role="button"/g)).toHaveLength(22);
    expect(html.match(/tabindex="0"/g)).toHaveLength(22);
    expect(html).toContain('aria-label="offense LT"');
    expect(html).toContain('aria-label="defense FS"');
  });

  it("keeps every primary studio action labeled and keyboard-native", () => {
    const source = readFileSync(new URL("../client/src/pages/TacticalTwinPage.tsx", import.meta.url), "utf8");
    const mapSource = readFileSync(new URL("../client/src/components/tactical-twin/TacticalTwinMap.tsx", import.meta.url), "utf8");
    expect(source).toContain('aria-label="Back to Tactical Twin library"');
    expect(source).toContain('aria-label={playing ? "Pause synchronized playback" : "Play synchronized reconstruction"}');
    expect(source).toContain('aria-label="Restart synchronized reconstruction"');
    expect(source).toContain('aria-label="Synchronized play timeline"');
    expect(source).toContain('"Original Film"');
    expect(source).toContain('"Tactical Map"');
    expect(source).toContain('"3D Twin"');
    expect(mapSource).toContain('event.key === "Enter" || event.key === " "');
    expect(mapSource).toContain('focus-visible:[&_circle]:stroke-white');
  });
});
