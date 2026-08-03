// Quick-glance flyer panel docked to the right of the map on pin click —
// the map stays visible/interactive behind it. "Details & RSVP" hands off
// to EventDetailModal for the full RSVP/check-in flow.
import { formatEventDateTime } from "../formatDate.js";
import FlyerDisplay from "./FlyerDisplay.jsx";

export default function EventFlyerPanel({ event, onClose, onOpenDetails }) {
  if (!event) return null;

  return (
    <section className="flyer-rail">
      <button type="button" className="flyer-rail-close" onClick={onClose} aria-label="Close flyer">
        ×
      </button>
      <FlyerDisplay event={event} className="flyer-rail-image" />
      <div className="flyer-rail-caption">
        <strong>{event.title}</strong>
        <div>{formatEventDateTime(event.event_date)}</div>
        <div>{event.location}</div>
      </div>
      <button type="button" className="btn btn-primary" onClick={onOpenDetails}>
        Details &amp; RSVP
      </button>
    </section>
  );
}
