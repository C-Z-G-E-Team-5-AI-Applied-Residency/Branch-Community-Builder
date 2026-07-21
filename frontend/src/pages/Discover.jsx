// Main page: interactive event map + list, AI recommendations at the top.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import EventMap from "../components/EventMap.jsx";
import EventCard from "../components/EventCard.jsx";
import EventDetailModal from "../components/EventDetailModal.jsx";
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
  const [recsOpen, setRecsOpen] = useState(false);
  const eventsListRef = useRef(null);
  const mapRef = useRef(null);
  const [nearFooter, setNearFooter] = useState(false);
  const [mapInView, setMapInView] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);

  function onScrollToEvents() {
    eventsListRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function onScrollToMap() {
    if (!mapRef.current) return;
    // scrollIntoView("start") sometimes lands a few px short, leaving a
    // sliver of the events section visible at the bottom; nudge it a
    // little further up so the map fully covers the fold.
    const targetY = window.scrollY + mapRef.current.getBoundingClientRect().top - 12;
    window.scrollTo({ top: Math.max(targetY, 0), behavior: "smooth" });
  }

  // Keeps the floating "Back to Map" button clear of the About/Contact
  // footer once it scrolls into view, instead of sitting on top of it.
  useEffect(() => {
    const footer = document.querySelector(".app-footer");
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => setNearFooter(entry.isIntersecting));
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  // Only show "Back to Map" once the map itself has scrolled out of view —
  // otherwise it'd double up with the "Event Search ↓" button on the map.
  useEffect(() => {
    if (!mapRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setMapInView(entry.isIntersecting));
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

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
    <main className="discover-shell">
      <div className="map-shell" ref={mapRef}>
        <nav className="map-nav-overlay">
          {me && <Link to={`/profile/${me.user_id}#my-events`}>Events</Link>}
          {me && <Link to={`/profile/${me.user_id}#my-rsvps`}>RSVPs</Link>}
          {me && <Link to={`/profile/${me.user_id}`}>Profile</Link>}
        </nav>

        {me && !recsOpen && (
          <button
            type="button"
            className="ai-rail-toggle"
            onClick={() => setRecsOpen(true)}
            aria-label="Recommended for you"
          >
            ✨
          </button>
        )}

        {me && recsOpen && (
          <section className="ai-rail">
            <button
              type="button"
              className="ai-rail-close"
              onClick={() => setRecsOpen(false)}
              aria-label="Close recommendations"
            >
              ×
            </button>
            <h2>✨ Recommended for you</h2>
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

        {center ? (
          <EventMap
            key={center.join(",")}
            events={events}
            center={center}
            height="100%"
            onSelectEvent={setSelectedEventId}
          />
        ) : (
          <EventMap events={events} height="100%" onSelectEvent={setSelectedEventId} />
        )}

        <button type="button" className="scroll-to-events" onClick={onScrollToEvents}>
          Event Search ↓
        </button>

        {selectedEventId && (
          <EventDetailModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
        )}
      </div>

      <div className="below-map">
        {!mapInView && (
          <button
            type="button"
            className={`back-to-map${nearFooter ? " back-to-map--above-footer" : ""}`}
            onClick={onScrollToMap}
          >
            ↑ Back to Map
          </button>
        )}
        <h1>Discover</h1>
        <h2 ref={eventsListRef}>Events</h2>
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
        {events.length ? (
          events.map((event) => <EventCard key={event.event_id} event={event} />)
        ) : (
          <p>No events found.</p>
        )}
      </div>
    </main>
  );
}
