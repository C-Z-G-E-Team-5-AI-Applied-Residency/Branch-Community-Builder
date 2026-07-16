// Host view: renders the event's check-in QR for attendees to scan.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "../components/QRCode.jsx";
import { api } from "../api/client.js";

const POLL_MS = 5000;

export default function HostCheckIn() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [rsvps, setRsvps] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getEvent(eventId).then(setEvent).catch((err) => setError(err.message));
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    const poll = () =>
      api.getEventRsvps(eventId).then((rows) => {
        if (!cancelled) setRsvps(rows);
      }).catch(() => {});
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventId]);

  if (error) return <main><h1>Check-In</h1><p role="alert">{error}</p></main>;
  if (!event) return <main><p>Loading…</p></main>;

  // The API only includes check_in_code when the requester is the host.
  if (!event.check_in_code) {
    return (
      <main>
        <h1>Check-In — {event.title}</h1>
        <p role="alert">Only the host can view this event's check-in code.</p>
        <Link to={`/events/${eventId}`}>Back to event</Link>
      </main>
    );
  }

  const going = rsvps.filter((r) => r.status === "going");
  const checkedIn = rsvps.filter((r) => r.did_attend);

  return (
    <main>
      <h1>Check-In — {event.title}</h1>
      <p>Have attendees scan this code:</p>
      <QRCode value={event.check_in_code} />
      <p>
        {checkedIn.length} checked in of {going.length} going (updates every{" "}
        {POLL_MS / 1000}s)
      </p>
      <ul>
        {checkedIn.map((r) => (
          <li key={r.rsvp_id}>✅ {r.username}</li>
        ))}
      </ul>
      <Link to={`/events/${eventId}`}>Back to event</Link>
    </main>
  );
}
