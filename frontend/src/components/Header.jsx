// Top bar per wireframe: [ BRANCH… ] brand, nav on the right.
// Signed in: Profile / My Events / My RSVPs / + Create Event all live on the
// Discover map's own overlay nav now (see BackToDiscover.jsx for the
// reverse trip back here). Sign out lives on the profile page instead.
// Signed out: About / Contact, plus Sign In (hidden on the sign-in page itself).
import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import BackToDiscover from "./BackToDiscover.jsx";

export default function Header() {
  // Signup/login happen without a route change (SignUp is a single-page step
  // flow), so useLocation() re-renders alone don't cover it — useAuth() gives
  // us live auth state (it listens for the "branch:user" event client.js fires
  // after each localStorage write) so the nav updates without a refresh.
  const me = useAuth();
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

  return (
    <header className="app-header" ref={headerRef}>
      <Link to="/discover" className="brand">[ BRANCH… ]</Link>
      <BackToDiscover />
      {!me && (
        <nav>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
          {pathname !== "/signin" && (
            <Link to="/signin" className="btn btn-primary">Sign In</Link>
          )}
        </nav>
      )}
    </header>
  );
}
