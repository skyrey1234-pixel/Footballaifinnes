# Higgsfield Connector Boundary

The user’s **Higgsfield connector is enabled** (`kind: mcp`, OAuth, non-editable) and is the correct account-level integration for Manus agent operations. It is not injected into the TacticalEdge production server as an environment variable, HTTP credential, or callable SDK. Therefore, the published app cannot safely reuse or extract that OAuth token.

The connector tool catalog was requested twice on September 9, 2026. The remote MCP endpoint timed out during TLS/transport discovery both times, while local configuration continued to report the connector as enabled. This is an endpoint availability issue, not a disabled-connector issue.

Stage 2 keeps the server provider adapter behind a configuration check. The coach-facing product can be completed and tested with provider calls mocked. A true one-click production export requires one of two secure bridges: **Higgsfield Cloud server API credentials** stored only in the app’s Secrets panel, or a separate Manus API/Open App credential that creates connector-enabled tasks. The existing enabled connector alone cannot be called from arbitrary browser or production-server code.

The application must never copy, reveal, or attempt to extract the user’s connector OAuth token. Cinematic outputs remain labeled as generated interpretations rather than verified scouting evidence.

