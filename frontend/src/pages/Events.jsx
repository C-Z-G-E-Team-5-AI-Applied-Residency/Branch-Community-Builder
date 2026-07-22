// "My Events": the events the signed-in user is hosting, independent of the
// map (see Discover.jsx for the map view). Reached via the map's overlay nav.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EventCard from "../components/EventCard.jsx";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Events() {
  const me = useAuth();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!me) return;
    // no host_id filter on the API yet — filter client-side (fine at MVP scale)
    api
      .listEvents()
      .then((all) => setEvents(all.filter((e) => e.host_id === me.user_id)))
      .catch(() => setEvents([]));
  }, [me]);

  return (
    <main>
      <h1>My Events</h1>
      {events.length ? (
        events.map((event) => (
          <div key={event.event_id}>
            <EventCard event={event} />
            <p>
              <Link to={`/events/${event.event_id}/host`}>Open host check-in (QR)</Link>
            </p>
          </div>
        ))
      ) : (
        <p>
          You haven't hosted any events yet. <Link to="/events/new">Create one</Link>.
        </p>
      )}
    </main>
  );
}
