// Single event: description, tags, RSVP button, attendee count, QR check-in.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, currentUser } from "../api/client.js";
import QRScanner from "../components/QRScanner.jsx";

export default function EventDetail() {
  const { eventId } = useParams();
  const me = currentUser();
  const [event, setEvent] = useState(null);
  const [rsvps, setRsvps] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const checkingIn = useRef(false); // scanner fires repeatedly; only submit once

  const load = useCallback(() => {
    api.getEvent(eventId).then(setEvent).catch((err) => setError(err.message));
    api.getEventRsvps(eventId).then(setRsvps).catch(() => setRsvps([]));
    api.getEventAnnouncements(eventId).then(setAnnouncements).catch(() => setAnnouncements([]));
  }, [eventId]);

  useEffect(load, [load]);

  if (error) return <main><h1>Event</h1><p role="alert">{error}</p></main>;
  if (!event) return <main><p>Loading…</p></main>;

  const isHost = me && me.user_id === event.host_id;
  const myRsvp = me ? rsvps.find((r) => r.user_id === me.user_id) : null;
  const goingCount = rsvps.filter((r) => r.status === "going").length;

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

  async function onScan(decoded) {
    if (checkingIn.current) return;
    checkingIn.current = true;
    try {
      await api.checkIn(event.event_id, decoded);
      setNotice("Checked in — see you there!");
      setScanning(false);
      load();
    } catch (err) {
      setNotice(err.message);
      checkingIn.current = false; // allow retry on a bad scan
    }
  }

  async function onPostAnnouncement(e) {
    e.preventDefault();
    if (!announcementDraft.trim()) return;
    setNotice(null);
    try {
      await api.postEventAnnouncement(event.event_id, announcementDraft.trim());
      setAnnouncementDraft("");
      load();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function onDeleteAnnouncement(announcementId) {
    setNotice(null);
    try {
      await api.deleteEventAnnouncement(event.event_id, announcementId);
      load();
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <main>
      <h1>{event.title}</h1>
      <p>
        {new Date(event.event_date).toLocaleString()} · {event.location} ·{" "}
        {event.event_zip_code}
      </p>
      <p>{event.event_description}</p>

      <section>
        <h2>Announcements</h2>
        {isHost && (
          <form onSubmit={onPostAnnouncement}>
            <input
              type="text"
              value={announcementDraft}
              onChange={(e) => setAnnouncementDraft(e.target.value)}
              placeholder="Post an announcement…"
            />
            <button type="submit">Post</button>
          </form>
        )}
        {announcements.length === 0 && <p>No announcements yet.</p>}
        <ul>
          {announcements.map((a) => (
            <li key={a.announcement_id}>
              {a.message}{" "}
              <em>({new Date(a.created_at).toLocaleString()})</em>
              {isHost && (
                <>
                  {" "}
                  <button onClick={() => onDeleteAnnouncement(a.announcement_id)}>Delete</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

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

      {me && !isHost && !myRsvp && <button onClick={onRsvp}>RSVP</button>}
      {me && myRsvp && myRsvp.status === "going" && !myRsvp.did_attend && (
        <>
          <button onClick={onCancel}>Cancel RSVP</button>{" "}
          <button onClick={() => setScanning((s) => !s)}>
            {scanning ? "Stop scanning" : "Scan host QR to check in"}
          </button>
        </>
      )}
      {me && myRsvp && myRsvp.status === "cancelled" && (
        <button
          onClick={async () => {
            await api.updateRsvp(myRsvp.rsvp_id, { status: "going" }).catch((err) => setNotice(err.message));
            load();
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
    </main>
  );
}
