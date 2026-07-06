// Leaflet map with a marker per event. Centered on the user's area.
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

export default function EventMap({ events = [], center = [37.7749, -122.4194] }) {
  return (
    <MapContainer center={center} zoom={12} style={{ height: 400, width: "100%" }}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {events.map((e) => (
        <Marker key={e.event_id} position={[e.latitude, e.longitude]}>
          <Popup>{e.title}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
