// Dedicated Community Standing page (BR-44): per-neighborhood standing —
// events attended, hosted events with confirmed-attendee turnout, and
// leader status — browsed one neighborhood at a time via prev/next arrows
// (or the left/right keys), with a slide animation in the step direction.
//
// The hosted-events breakdown comes from GET .../standings itself (server
// resolves each event's neighborhood with the same lookup that incremented
// events_hosted), not a separate client-side pass over every event in the
// system — that keeps the count above the list and the list itself from
// ever disagreeing about which neighborhood an event belongs to.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function CommunityStanding() {
  const { userId } = useParams();
  const me = useAuth();
  const isOwn = me && me.user_id === Number(userId);

  const [standings, setStandings] = useState(null);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState("right");
  const [error, setError] = useState(null);

  useEffect(() => {
    setIndex(0);
    api.getUserStandings(userId).then(setStandings).catch((err) => setError(err.message));
  }, [userId]);

  // Bound here (not below the early returns) since hooks must run
  // unconditionally every render; the standings.length < 2 guard inside
  // covers the not-loaded-yet and single-neighborhood cases.
  useEffect(() => {
    function onKeyDown(e) {
      if (!standings || standings.length < 2) return;
      // Don't hijack arrow keys from an actual form control on the page.
      if (e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft") {
        setDirection("left");
        setIndex((i) => (i - 1 + standings.length) % standings.length);
      } else if (e.key === "ArrowRight") {
        setDirection("right");
        setIndex((i) => (i + 1) % standings.length);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [standings]);

  if (error) return <main><h1>Community Standing</h1><p role="alert">{error}</p></main>;
  if (!standings) return <main><p>Loading…</p></main>;

  if (!standings.length) {
    return (
      <main>
        <h1>Community Standing</h1>
        <p>No community activity yet.</p>
        <p><Link to={`/profile/${userId}`}>← Back to profile</Link></p>
      </main>
    );
  }

  const standing = standings[index];
  const hostedHere = standing.hosted_events;
  const goPrev = () => {
    setDirection("left");
    setIndex((i) => (i - 1 + standings.length) % standings.length);
  };
  const goNext = () => {
    setDirection("right");
    setIndex((i) => (i + 1) % standings.length);
  };

  return (
    <main>
      <h1>Community Standing</h1>
      <p><Link to={`/profile/${userId}`}>← Back to profile</Link></p>

      {/* Not the visible position label below — that's redundant to a sighted
          user tracking the slide animation. This is what a screen reader
          hears after Prev/Next, since the card swap itself is silent. */}
      <p className="visually-hidden" aria-live="polite">
        {standing.neighborhood_name}, {index + 1} of {standings.length}
      </p>

      <div className="standing-carousel">
        <button
          type="button"
          className="standing-nav-btn"
          onClick={goPrev}
          disabled={standings.length < 2}
          aria-label="Previous neighborhood"
        >
          ‹
        </button>

        <div
          key={standing.standing_id}
          className={`card standing-card standing-slide-${direction}`}
        >
          <h2>
            {standing.neighborhood_name} <span className="standing-city">({standing.city})</span>
          </h2>

          <p className="standing-stat">
            <strong>{standing.events_attended}</strong> event{standing.events_attended === 1 ? "" : "s"} attended
          </p>

          <div className="standing-hosted">
            <p className="standing-stat">
              <strong>{standing.events_hosted}</strong> event{standing.events_hosted === 1 ? "" : "s"} hosted
            </p>
            {hostedHere.length > 0 && (
              <ul className="plain">
                {hostedHere.map((e) => (
                  <li key={e.event_id}>
                    {e.title} — {e.confirmed_count} confirmed to attend
                  </li>
                ))}
              </ul>
            )}
          </div>

          {standing.is_leader && (
            <span className="leader-bubble">
              🌿 {isOwn ? "You are a leader" : "Leader"} in {standing.neighborhood_name}!
            </span>
          )}
        </div>

        <button
          type="button"
          className="standing-nav-btn"
          onClick={goNext}
          disabled={standings.length < 2}
          aria-label="Next neighborhood"
        >
          ›
        </button>
      </div>

      {standings.length > 1 && (
        <p className="standing-position">
          {index + 1} of {standings.length}
        </p>
      )}
    </main>
  );
}
