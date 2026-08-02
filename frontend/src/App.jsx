import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import Discover from "./pages/Discover.jsx";
import Events from "./pages/Events.jsx";
import RSVPs from "./pages/RSVPs.jsx";
import CreateEvent from "./pages/CreateEvent.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import Profile from "./pages/Profile.jsx";
import CommunityStanding from "./pages/CommunityStanding.jsx";
import HostCheckIn from "./pages/HostCheckIn.jsx";
import Review from "./pages/Review.jsx";
import Metrics from "./pages/Metrics.jsx";
import Prompts from "./pages/Prompts.jsx";

// Everything except sign-in/sign-up requires a signed-in user; visitors
// without a session land on the sign-in page.
function RequireAuth({ children }) {
  const me = useAuth();
  return me ? children : <Navigate to="/signin" replace />;
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/discover" replace />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/discover" element={<RequireAuth><Discover /></RequireAuth>} />
        <Route path="/events" element={<RequireAuth><Events /></RequireAuth>} />
        <Route path="/rsvps" element={<RequireAuth><RSVPs /></RequireAuth>} />
        <Route path="/prompts" element={<RequireAuth><Prompts /></RequireAuth>} />
        <Route path="/events/new" element={<RequireAuth><CreateEvent /></RequireAuth>} />
        <Route path="/events/:eventId" element={<RequireAuth><EventDetail /></RequireAuth>} />
        <Route path="/events/:eventId/host" element={<RequireAuth><HostCheckIn /></RequireAuth>} />
        <Route path="/profile/:userId" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route
          path="/profile/:userId/standing"
          element={<RequireAuth><CommunityStanding /></RequireAuth>}
        />
        {/* Admin-gated server-side (403 for non-admins); the nav link is also admin-only. */}
        <Route path="/review" element={<RequireAuth><Review /></RequireAuth>} />
        <Route path="/metrics" element={<RequireAuth><Metrics /></RequireAuth>} />
      </Routes>
      <Footer />
    </>
  );
}
