// Main page: interactive event map + list, AI recommendations at the top.
import EventMap from "../components/EventMap.jsx";
export default function Discover() {
  return (
    <main>
      <h1>Discover</h1>
      {/* TODO: zip search, api.listEvents, api.getRecommendations */}
      <EventMap events={[]} />
    </main>
  );
}
