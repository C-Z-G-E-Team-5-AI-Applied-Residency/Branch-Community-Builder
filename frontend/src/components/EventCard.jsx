// Compact event card for lists and the recommendations rail.
export default function EventCard({ event, reason }) {
  return (
    <article>
      <h3>{event?.title}</h3>
      {reason && <p><em>{reason}</em></p>}
      {/* TODO: date, location, RSVP button */}
    </article>
  );
}
