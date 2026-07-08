// Compact event card for lists and the recommendations rail.
import { Link } from "react-router-dom";

export default function EventCard({ event, reason }) {
  if (!event) return null;
  return (
    <article style={{ background: "white", borderRadius: 8, padding: "0.75rem", marginBottom: "0.5rem" }}>
      <h3 style={{ margin: "0 0 0.25rem" }}>
        <Link to={`/events/${event.event_id}`}>{event.title}</Link>
      </h3>
      <p style={{ margin: 0 }}>
        {new Date(event.event_date).toLocaleString()} · {event.location}
      </p>
      {reason && (
        <p style={{ margin: "0.25rem 0 0" }}>
          <em>✨ {reason}</em>
        </p>
      )}
    </article>
  );
}
