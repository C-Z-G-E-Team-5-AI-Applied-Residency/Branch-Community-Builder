// Tutorial: practice finding events by tapping pins on a real map.
import { useState } from "react";
import EventMap from "../EventMap.jsx";
import { DEMO_EVENTS } from "./demoData.js";

export default function MapSlide() {
  const [seen, setSeen] = useState(false);

  return (
    <div>
      <p>
        This is the Discover map — every pin is an event happening near you.{" "}
        <strong>Tap a pin</strong> to see what it is.
      </p>
      <EventMap
        events={DEMO_EVENTS}
        height={280}
        onMarkerClick={() => setSeen(true)}
        renderPopup={(e) => (
          <>
            <strong>{e.title}</strong>
            <br />
            {new Date(e.event_date).toLocaleString()}
            <br />
            <em>On the real map, this links to the full event page.</em>
          </>
        )}
      />
      <p role="status">
        {seen
          ? "✅ That's it — every pin opens into details and an RSVP button."
          : "Go ahead, give one a tap."}
      </p>
    </div>
  );
}
