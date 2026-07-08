// Main page: interactive event map + list, AI recommendations at the top.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EventMap from "../components/EventMap.jsx";
import EventCard from "../components/EventCard.jsx";
import { api, currentUser } from "../api/client.js";

export default function Discover() {
  const me = currentUser();
  const [events, setEvents] = useState([]);
  const [recs, setRecs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    api.listEvents({ status: "open" }).then(setEvents).catch(() => setEvents([]));
    if (me) api.getRecommendations(me.user_id).then(setRecs).catch(() => setRecs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRefreshRecs() {
    setRefreshing(true);
    setNotice(null);
    try {
      const fresh = await api.refreshRecommendations(me.user_id);
      setRecs(fresh);
      if (!fresh.length) setNotice("No recommendations yet — try adding interests, or check back later.");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main>
      <nav style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <strong>BRANCH</strong>
        <Link to="/events/new">Host an event</Link>
        {me ? (
          <Link to={`/profile/${me.user_id}`}>My profile ({me.username})</Link>
        ) : (
          <Link to="/signin">Sign in</Link>
        )}
      </nav>
      <h1>Discover</h1>

      {me && (
        <section>
          <h2>Recommended for you</h2>
          {recs.length ? (
            recs.map((rec) => <EventCard key={rec.recommendation_id} event={rec.event} reason={rec.reason} />)
          ) : (
            <p>
              Nothing here yet.{" "}
              <button onClick={onRefreshRecs} disabled={refreshing}>
                {refreshing ? "Asking the matchmaker…" : "Get recommendations"}
              </button>
            </p>
          )}
          {recs.length > 0 && (
            <button onClick={onRefreshRecs} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}
          {notice && <p role="status">{notice}</p>}
        </section>
      )}

      <h2>Events</h2>
      <EventMap events={events} />
      {events.length ? (
        events.map((event) => <EventCard key={event.event_id} event={event} />)
      ) : (
        <p>No events found.</p>
      )}
    </main>
  );
}
