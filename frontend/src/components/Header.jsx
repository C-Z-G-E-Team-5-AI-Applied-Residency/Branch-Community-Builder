// Top bar per wireframe: [ BRANCH… ] brand, nav on the right.
// Signed in: Profile / My Events / My RSVPs / + Create Event.
// Signed out: About / Contact, plus Sign In (hidden on the sign-in page itself).
import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, currentUser } from "../api/client.js";
import BackToDiscover from "./BackToDiscover.jsx";

export default function Header() {
  const me = currentUser();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const headerRef = useRef(null);

  // The nav wraps to two lines on narrow screens, so the header's real
  // height varies; publish it as a CSS var so full-bleed layouts (the
  // discover map) can size themselves off the actual value instead of a
  // guessed pixel constant.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setVar = () => document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    setVar();
    const observer = new ResizeObserver(setVar);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  async function onLogout() {
    await api.logout().catch(() => {});
    navigate("/signin");
  }

  return (
    <header className="app-header" ref={headerRef}>
      <Link to="/discover" className="brand">[ BRANCH… ]</Link>
      <BackToDiscover />
      <nav>
        {me ? (
          <>
            <Link to={`/profile/${me.user_id}`}>Profile</Link>
            <Link to={`/profile/${me.user_id}#my-events`}>My Events</Link>
            <Link to={`/profile/${me.user_id}#my-rsvps`}>My RSVPs</Link>
            <Link to="/events/new" className="btn btn-primary">+ Create Event</Link>
            <button onClick={onLogout}>Sign out</button>
          </>
        ) : (
          <>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
            {pathname !== "/signin" && (
              <Link to="/signin" className="btn btn-primary">Sign In</Link>
            )}
          </>
        )}
      </nav>
    </header>
  );
}
