// Small "back to the map" link for pages reached from Discover's overlay
// nav (Events, RSVPs, Profile — all of which are anchors on /profile/:id
// today). Self-contained so it can be mounted anywhere without the caller
// needing to check the route.
import { Link, useLocation } from "react-router-dom";

export default function BackToDiscover() {
  const { pathname } = useLocation();
  if (!pathname.startsWith("/profile")) return null;
  return (
    <Link to="/discover" className="back-to-discover">
      ← Back to Discover
    </Link>
  );
}
