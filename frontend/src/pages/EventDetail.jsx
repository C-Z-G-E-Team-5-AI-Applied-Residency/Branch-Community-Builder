// Single event: description, tags, RSVP button, attendee count.
import { useParams } from "react-router-dom";
export default function EventDetail() {
  const { eventId } = useParams();
  return <main><h1>Event {eventId}</h1>{/* TODO: api.getEvent, api.rsvp */}</main>;
}
