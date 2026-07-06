// Host view: renders the event's check-in QR for attendees to scan.
import { useParams } from "react-router-dom";
import QRCode from "../components/QRCode.jsx";
export default function HostCheckIn() {
  const { eventId } = useParams();
  return (
    <main>
      <h1>Check-In — Event {eventId}</h1>
      {/* TODO: fetch event.check_in_code */}
      <QRCode value={`branch:checkin:${eventId}`} />
    </main>
  );
}
