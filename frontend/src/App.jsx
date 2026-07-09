import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import Discover from "./pages/Discover.jsx";
import CreateEvent from "./pages/CreateEvent.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import Profile from "./pages/Profile.jsx";
import HostCheckIn from "./pages/HostCheckIn.jsx";

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/discover" replace />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/events/new" element={<CreateEvent />} />
        <Route path="/events/:eventId" element={<EventDetail />} />
        <Route path="/events/:eventId/host" element={<HostCheckIn />} />
        <Route path="/profile/:userId" element={<Profile />} />
      </Routes>
      <Footer />
    </>
  );
}
