// Small "back to the map" link for pages reached from Discover's overlay
// nav (Events, RSVPs, Profile). Self-contained so it can be mounted
// anywhere without the caller needing to check the route.
import { Link, useLocation } from "react-router-dom";

const PAGES = ["/events", "/rsvps"];

export default function BackToDiscover() {
  const { pathname } = useLocation();
  if (!pathname.startsWith("/profile") && !PAGES.includes(pathname)) return null;
  return (
    <Link to="/discover" className="back-to-discover">
      ← Back to Discover
    </Link>
  );
}
