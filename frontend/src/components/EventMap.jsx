// Leaflet map with a marker per event. Centered on the user's area.
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Vite doesn't serve Leaflet's default icon paths; point them at bundled assets.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function EventMap({ events = [], center = [40.7359, -74.0036], height = 400 }) {
  return (
    <MapContainer center={center} zoom={12} style={{ height, width: "100%" }}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {events.map((e) => (
        <Marker key={e.event_id} position={[e.latitude, e.longitude]}>
          <Popup>
            <strong>{e.title}</strong>
            <br />
            {new Date(e.event_date).toLocaleString()}
            <br />
            <Link to={`/events/${e.event_id}`}>Details &amp; RSVP</Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
