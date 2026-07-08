// Single event: description, tags, RSVP button, attendee count.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, currentUser } from "../api/client.js";

export default function EventDetail() {
  const { eventId } = useParams();
  const me = currentUser();
  const [event, setEvent] = useState(null);
  const [rsvps, setRsvps] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getEvent(eventId).then(setEvent).catch((err) => setError(err.message));
    api.getEventRsvps(eventId, { status: "going" }).then(setRsvps).catch(() => setRsvps([]));
  }, [eventId]);

  if (error) return <main><h1>Event</h1><p role="alert">{error}</p></main>;
  if (!event) return <main><p>Loading…</p></main>;

  const isHost = me && me.user_id === event.host_id;

  return (
    <main>
      <h1>{event.title}</h1>
      <p>
        {new Date(event.event_date).toLocaleString()} · {event.location} ·{" "}
        {event.event_zip_code}
      </p>
      <p>{event.event_description}</p>
      <p>
        {rsvps.length} going · capacity {event.event_capacity} · status {event.status}
      </p>
      <p>
        Hosted by <Link to={`/profile/${event.host_id}`}>user #{event.host_id}</Link>
      </p>
      <ul>
        {event.tags.map((tag) => (
          <li key={tag.tag_id}>{tag.name}</li>
        ))}
      </ul>
      {isHost && (
        <p>
          <Link to={`/events/${event.event_id}/host`}>Open host check-in (QR)</Link>
        </p>
      )}
    </main>
  );
}
