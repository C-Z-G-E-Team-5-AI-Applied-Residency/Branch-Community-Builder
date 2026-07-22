// Event details + RSVP, layered over the full-page map instead of navigating
// away. Mirrors EventDetail.jsx's data/actions; closable via the X or by
// clicking the backdrop.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import QRScanner from "./QRScanner.jsx";

function ordinal(day) {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

function formatCheckInOpensNotice(opensAt) {
  const diffMs = opensAt - new Date();
  if (diffMs <= 0) return "now open";

  const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const countdown =
    [
      days > 0 ? `${days} day${days === 1 ? "" : "s"}` : null,
      hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : null,
    ]
      .filter(Boolean)
      .join(", ") || "less than an hour";

  const weekday = opensAt.toLocaleDateString("en-US", { weekday: "long" });
  const month = opensAt.toLocaleDateString("en-US", { month: "long" });
  const time = opensAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return `In ${countdown} on ${weekday}, ${month} ${ordinal(opensAt.getDate())} ${time}`;
}

export default function EventDetailModal({ eventId, onClose }) {
  const me = useAuth();
  const [event, setEvent] = useState(null);
  const [rsvps, setRsvps] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const checkingIn = useRef(false); // scanner fires repeatedly; only submit once

  // Returns a promise (resolving once both fetches settle) so callers can
  // await a refresh after an action instead of firing-and-forgetting it —
  // each branch already catches its own error, so this never rejects.
  const load = useCallback(() => {
    return Promise.all([
      api.getEvent(eventId).then(setEvent).catch((err) => {
        setError(err.message);
        console.error("EventDetailModal: failed to refresh event:", err);
      }),
      api.getEventRsvps(eventId).then(setRsvps).catch((err) => {
        setRsvps([]);
        console.error("EventDetailModal: failed to refresh RSVPs:", err);
      }),
    ]);
  }, [eventId]);

  useEffect(load, [load]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const isHost = me && event && me.user_id === event.host_id;
  const myRsvp = me ? rsvps.find((r) => r.user_id === me.user_id) : null;
  const goingCount = rsvps.filter((r) => r.status === "going").length;

  const checkInOpensBeforeHours = event?.check_in_opens_before_hours;
  const checkInOpensAt = event
    ? new Date(new Date(event.event_date).getTime() - checkInOpensBeforeHours * 60 * 60 * 1000)
    : null;

  const eventEnd = event ? new Date(event.event_end_date || event.event_date) : null;
  const hasEnded = eventEnd ? Date.now() > eventEnd : false;

  async function onRsvp() {
    setNotice(null);
    try {
      await api.rsvp(event.event_id);
      setNotice("You're going!");
      await load();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function onCancel() {
    setNotice(null);
    try {
      await api.updateRsvp(myRsvp.rsvp_id, { status: "cancelled" });
      setNotice("RSVP cancelled.");
      await load();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function onScan(decoded) {
    if (checkingIn.current) return;
    checkingIn.current = true;
    try {
      await api.checkIn(event.event_id, decoded);
      setNotice("Checked in — see you there!");
      setScanning(false);
      await load();
    } catch (err) {
      setNotice(err.message);
      checkingIn.current = false; // allow retry on a bad scan
    }
  }

  return (
    <div className="event-modal-backdrop" onClick={onClose}>
      <div className="event-modal card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="event-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {error && <p role="alert">{error}</p>}
        {!error && !event && <p>Loading…</p>}

        {event && (
          <>
            <h1>{event.title}</h1>
            <p>
              {new Date(event.event_date).toLocaleString()} · {event.location} ·{" "}
              {event.event_zip_code}
            </p>
            <p>{event.event_description}</p>
            <p>
              {goingCount} going · capacity {event.event_capacity} · status {event.status}
            </p>
            <p>
              Hosted by <Link to={`/profile/${event.host_id}`}>user #{event.host_id}</Link>
            </p>
            <ul>
              {event.tags.map((tag) => (
                <li key={tag.tag_id}>{tag.name}</li>
              ))}
            </ul>

            {notice && <p role="status">{notice}</p>}

            {me && !isHost && !myRsvp && hasEnded && <p>This event has ended.</p>}
            {me && !isHost && !myRsvp && !hasEnded && <button onClick={onRsvp}>RSVP</button>}
            {me && myRsvp && myRsvp.status === "going" && !myRsvp.did_attend && (
              <>
                <button onClick={onCancel}>Cancel RSVP</button>{" "}
                <button onClick={() => setScanning((s) => !s)}>
                  {scanning ? "Stop scanning" : "Scan host QR to check in"}
                </button>
                <p>
                  Check-in opens {checkInOpensBeforeHours} hour
                  {checkInOpensBeforeHours === 1 ? "" : "s"} before the event (
                  {formatCheckInOpensNotice(checkInOpensAt)}).
                </p>
              </>
            )}
            {me && myRsvp && myRsvp.status === "cancelled" && hasEnded && <p>This event has ended.</p>}
            {me && myRsvp && myRsvp.status === "cancelled" && !hasEnded && (
              <button
                onClick={async () => {
                  await api.updateRsvp(myRsvp.rsvp_id, { status: "going" }).catch((err) => setNotice(err.message));
                  await load();
                }}
              >
                Re-confirm RSVP
              </button>
            )}
            {myRsvp?.did_attend && <p>✅ Checked in</p>}
            {!me && (
              <p>
                <Link to="/signin">Sign in</Link> to RSVP.
              </p>
            )}

            {scanning && <QRScanner onScan={onScan} />}

            {isHost && (
              <p>
                <Link to={`/events/${event.event_id}/host`}>Open host check-in (QR)</Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
