// Main page: full-page interactive event map. Search happens right on the
// map (zip/location overlay, top-left) — no separate event list here
// anymore; see Events.jsx/RSVPs.jsx for those dedicated pages.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EventMap from "../components/EventMap.jsx";
import EventCard from "../components/EventCard.jsx";
import EventDetailModal from "../components/EventDetailModal.jsx";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Discover() {
  const me = useAuth();
  const [events, setEvents] = useState([]);
  const [recs, setRecs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [zip, setZip] = useState("");
  const [center, setCenter] = useState(null); // [lat, lng] from a zip/location search
  const [zoom, setZoom] = useState(12);
  const [searchNote, setSearchNote] = useState(null);
  const [recsOpen, setRecsOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  // Mobile-only dropdown state — on wide screens the nav/search bars ignore
  // these and stay always-visible (see the max-width:900px CSS).
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    api.listEvents({ status: "open" }).then(setEvents).catch(() => setEvents([]));
    if (me) api.getRecommendations(me.user_id).then(setRecs).catch(() => setRecs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onZipSearch(e) {
    e.preventDefault();
    const trimmed = zip.trim();
    if (!trimmed) {
      onClearSearch();
      return;
    }
    // pattern="\d{5}" on the input is browser-dependent HTML5 validation
    // (and doesn't run at all if the form is submitted programmatically) —
    // enforce the same 5-digit shape explicitly before hitting the API.
    if (!/^\d{5}$/.test(trimmed)) {
      setSearchNote("Please enter a valid 5-digit ZIP code.");
      return;
    }
    setSearchNote(null);
    try {
      const found = await api.listEvents({ status: "open", zip_code: trimmed });
      setEvents(found);
      if (found.length) {
        setCenter([found[0].latitude, found[0].longitude]);
        setZoom(14); // zoom in over the searched ZIP instead of the city-wide default
      } else {
        setSearchNote(`No open events in ${trimmed}.`);
      }
    } catch (err) {
      setSearchNote(err.message);
    }
  }

  // Zooms back out to the city-wide default view — used both when the zip
  // field is cleared and resubmitted, and via the explicit Clear button.
  function onClearSearch() {
    setZip("");
    setSearchNote(null);
    setCenter(null);
    setZoom(12);
    api.listEvents({ status: "open" }).then(setEvents).catch(() => setEvents([]));
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
      <div className="map-shell">
        {/* Positioned as one unit so narrow screens can stack these into a
            toolbar above the map (see the max-width:640px rules) instead of
            each floating independently and colliding with the others. */}
        <div className="map-toolbar">
          <div className="toolbar-dropdown-toggles">
            <button type="button" onClick={() => setNavOpen((o) => !o)}>
              ☰ Menu
            </button>
            <button type="button" onClick={() => setSearchOpen((o) => !o)}>
              🔍 Search
            </button>
          </div>

          <nav className={`map-nav-overlay${navOpen ? " is-open" : ""}`}>
            {me && (
              <Link to="/events/new" className="btn btn-primary">
                + Create Event
              </Link>
            )}
            {me && <Link to="/events">My Events</Link>}
            {me && <Link to="/rsvps">My RSVPs</Link>}
            {me && <Link to={`/profile/${me.user_id}`}>Profile</Link>}
          </nav>

          <div className={`map-search-overlay${searchOpen ? " is-open" : ""}`}>
            <form onSubmit={onZipSearch}>
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
              {(zip || center) && (
                <button type="button" onClick={onClearSearch}>
                  Clear
                </button>
              )}
            </form>
            {searchNote && <p role="status">{searchNote}</p>}
          </div>

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
        </div>

        <EventMap
          events={events}
          {...(center ? { center } : {})}
          zoom={zoom}
          height="100%"
          onSelectEvent={setSelectedEventId}
        />

        {selectedEventId && (
          <EventDetailModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
        )}
      </div>
    </main>
  );
}
