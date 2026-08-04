// Quick-glance flyer + RSVP panel docked to the right of the map on pin
// click — the map stays visible/interactive behind it. Full description,
// tags, and host/check-in tools live on the full event page (linked at the
// bottom); this panel covers the common case — see the flyer, RSVP — without
// ever leaving the map.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatEventDateTime } from "../formatDate.js";
import FlyerDisplay from "./FlyerDisplay.jsx";

export default function EventFlyerPanel({ event, onClose }) {
  const me = useAuth();
  const [rsvps, setRsvps] = useState([]);
  const [notice, setNotice] = useState(null);

  const eventId = event?.event_id;

  const load = useCallback(() => {
    if (!eventId) return;
    api.getEventRsvps(eventId).then(setRsvps).catch(() => setRsvps([]));
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!event) return null;

  const isHost = me && me.user_id === event.host_id;
  const myRsvp = me ? rsvps.find((r) => r.user_id === me.user_id) : null;
  const goingCount = rsvps.filter((r) => r.status === "going").length;
  const hasEnded = Date.now() > new Date(event.event_end_date || event.event_date);

  async function onRsvp() {
    setNotice(null);
    try {
      await api.rsvp(event.event_id);
      setNotice("You're going!");
      load();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function onCancel() {
    setNotice(null);
    try {
      await api.updateRsvp(myRsvp.rsvp_id, { status: "cancelled" });
      setNotice("RSVP cancelled.");
      load();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function onReconfirm() {
    setNotice(null);
    try {
      await api.updateRsvp(myRsvp.rsvp_id, { status: "going" });
      load();
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <section className="flyer-rail">
      <button type="button" className="flyer-rail-close" onClick={onClose} aria-label="Close flyer">
        ×
      </button>

      <h2 className="flyer-rail-title">{event.title}</h2>

      <FlyerDisplay event={event} className="flyer-rail-image" />

      <p className="flyer-rail-meta">
        {formatEventDateTime(event.event_date)} · {event.location}
      </p>

      <p className="flyer-rail-going">
        {goingCount} going · capacity {event.event_capacity}
      </p>

      {notice && (
        <p role="status" className="flyer-rail-notice">
          {notice}
        </p>
      )}

      <div className="flyer-rail-rsvp">
        {!me && (
          <p>
            <Link to="/signin">Sign in</Link> to RSVP.
          </p>
        )}
        {me && isHost && <p className="flyer-rail-host-note">You're hosting this event.</p>}
        {me && !isHost && !myRsvp && hasEnded && <p>This event has ended.</p>}
        {me && !isHost && !myRsvp && !hasEnded && (
          <button type="button" className="btn btn-primary" onClick={onRsvp}>
            RSVP
          </button>
        )}
        {me && !isHost && myRsvp?.status === "going" && !myRsvp.did_attend && (
          <button type="button" onClick={onCancel}>
            Cancel RSVP
          </button>
        )}
        {me && !isHost && myRsvp?.status === "cancelled" && !hasEnded && (
          <button type="button" className="btn btn-primary" onClick={onReconfirm}>
            Re-confirm RSVP
          </button>
        )}
        {myRsvp?.did_attend && <p>✅ Checked in</p>}
      </div>

      <Link to={`/events/${event.event_id}`} className="flyer-rail-full-link">
        Full details, tags &amp; check-in →
      </Link>
    </section>
  );
}
