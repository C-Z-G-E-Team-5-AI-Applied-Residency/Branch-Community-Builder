// Tutorial: shows the real recommendations rail (EventCard + reason) with demo picks.
import EventCard from "../EventCard.jsx";
import { DEMO_EVENTS } from "./demoData.js";

export default function RecsSlide() {
  return (
    <div>
      <p>
        Branch's AI matchmaker suggests events on your Discover page — each one
        comes with the reason it was picked for you:
      </p>
      <EventCard
        event={DEMO_EVENTS[1]}
        reason="You're into photography, and this walk is a short trip from your neighborhood."
        link={false}
      />
      <EventCard
        event={DEMO_EVENTS[2]}
        reason="People who checked in to events like yours loved this one."
        link={false}
      />
      <p>
        It learns from your interests, RSVPs, and check-ins — the more you show
        up, the better the picks get. Next up: tell us what you're into.
      </p>
    </div>
  );
}
