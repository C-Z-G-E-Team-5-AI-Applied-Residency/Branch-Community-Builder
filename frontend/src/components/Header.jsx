// Top bar per wireframe: [ BRANCH… ] brand, nav on the right.
// Signed in: Profile / My Events / My RSVPs / + Create Event.
// Signed out: About / Contact, plus Sign In (hidden on the sign-in page itself).
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, currentUser } from "../api/client.js";

export default function Header() {
  const me = currentUser();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  async function onLogout() {
    await api.logout().catch(() => {});
    navigate("/signin");
  }

  return (
    <header className="app-header">
      <Link to="/discover" className="brand">[ BRANCH… ]</Link>
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
