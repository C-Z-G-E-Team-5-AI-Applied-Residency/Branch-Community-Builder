// Main page: interactive event map + list, AI recommendations at the top.
import { useEffect, useState } from "react";
import EventMap from "../components/EventMap.jsx";
import EventCard from "../components/EventCard.jsx";
import { api, currentUser } from "../api/client.js";

export default function Discover() {
  const me = currentUser();
  const [events, setEvents] = useState([]);
  const [recs, setRecs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [zip, setZip] = useState("");
  const [center, setCenter] = useState(null); // [lat, lng] from "use my location"
  const [searchNote, setSearchNote] = useState(null);

  useEffect(() => {
    api.listEvents({ status: "open" }).then(setEvents).catch(() => setEvents([]));
    if (me) api.getRecommendations(me.user_id).then(setRecs).catch(() => setRecs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onZipSearch(e) {
    e.preventDefault();
    setSearchNote(null);
    try {
      const found = await api.listEvents({ status: "open", zip_code: zip });
      setEvents(found);
      if (found.length) setCenter([found[0].latitude, found[0].longitude]);
      else setSearchNote(`No open events in ${zip}.`);
    } catch (err) {
      setSearchNote(err.message);
    }
  }

  function onUseMyLocation() {
    setSearchNote(null);
    if (!navigator.geolocation) {
      setSearchNote("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const found = await api.listEvents({
            status: "open",
            lat: coords.latitude,
            lng: coords.longitude,
            radius: 10,
          });
          setEvents(found);
          setCenter([coords.latitude, coords.longitude]);
          if (!found.length) setSearchNote("No open events within 10 miles.");
        } catch (err) {
          setSearchNote(err.message);
        }
      },
      () => setSearchNote("Couldn't get your location — check browser permissions.")
    );
  }

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
      <form onSubmit={onZipSearch} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="Search by ZIP"
          pattern="\d{5}"
        />
        <button type="submit">Search</button>
        <button type="button" onClick={onUseMyLocation}>
          Use my location
        </button>
      </form>
      {searchNote && <p role="status">{searchNote}</p>}
      {center ? <EventMap key={center.join(",")} events={events} center={center} /> : <EventMap events={events} />}
      {events.length ? (
        events.map((event) => <EventCard key={event.event_id} event={event} />)
      ) : (
        <p>No events found.</p>
      )}
    </main>
  );
}
