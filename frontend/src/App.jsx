import { Routes, Route, Navigate } from "react-router-dom";
import { currentUser } from "./api/client.js";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import Discover from "./pages/Discover.jsx";
import CreateEvent from "./pages/CreateEvent.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import Profile from "./pages/Profile.jsx";
import HostCheckIn from "./pages/HostCheckIn.jsx";

// Everything except sign-in/sign-up requires a signed-in user; visitors
// without a session land on the sign-in page.
function RequireAuth({ children }) {
  return currentUser() ? children : <Navigate to="/signin" replace />;
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
        <Route path="/events/new" element={<RequireAuth><CreateEvent /></RequireAuth>} />
        <Route path="/events/:eventId" element={<RequireAuth><EventDetail /></RequireAuth>} />
        <Route path="/events/:eventId/host" element={<RequireAuth><HostCheckIn /></RequireAuth>} />
        <Route path="/profile/:userId" element={<RequireAuth><Profile /></RequireAuth>} />
      </Routes>
      <Footer />
    </>
  );
}
