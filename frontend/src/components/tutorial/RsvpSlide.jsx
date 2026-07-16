// Tutorial: practice RSVPing (and cancelling) on a fake event — no API calls.
import { useState } from "react";
import { DEMO_EVENTS } from "./demoData.js";

export default function RsvpSlide() {
  const [going, setGoing] = useState(false);
  const event = DEMO_EVENTS[0];

  return (
    <div>
      <p>
        Found something you like? RSVP so the host knows you're coming.{" "}
        <strong>Try it</strong> on this practice event:
      </p>
      <article style={{ background: "white", borderRadius: 8, padding: "0.75rem" }}>
        <h3 style={{ margin: "0 0 0.25rem" }}>{event.title}</h3>
        <p style={{ margin: 0 }}>
          {new Date(event.event_date).toLocaleString()} · {event.location}
        </p>
        <p>{3 + (going ? 1 : 0)} going · capacity 10</p>
        {going ? (
          <>
            <p role="status">You're going!</p>
            <button type="button" onClick={() => setGoing(false)}>
              Cancel RSVP
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setGoing(true)}>
            RSVP
          </button>
        )}
      </article>
      <p>
        {going
          ? "✅ Your RSVPs show up on your profile and in the host's headcount."
          : "Plans change — you can always cancel, and hosts appreciate the heads-up."}
      </p>
    </div>
  );
}
