// Community Leader badge — shown when a user leads in any neighborhood.
import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function LeaderBadge({ userId }) {
  const [leaderIn, setLeaderIn] = useState([]);

  useEffect(() => {
    api
      .getUserStandings(userId)
      .then((standings) => setLeaderIn(standings.filter((s) => s.is_leader)))
      .catch(() => setLeaderIn([]));
  }, [userId]);

  if (!leaderIn.length) return null;

  const names = leaderIn.map((s) => s.neighborhood_name).join(", ");
  return (
    <span
      title={`Community Leader in ${names}`}
      style={{
        background: "var(--branch-green-light)",
        color: "white",
        borderRadius: "999px",
        padding: "0.15rem 0.6rem",
        fontSize: "0.85rem",
        fontWeight: 600,
      }}
    >
      🌿 Community Leader · {names}
    </span>
  );
}
