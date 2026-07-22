// Leaflet map with a marker per event. Centered on the user's area.
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Vite doesn't serve Leaflet's default icon paths; point them at bundled assets.
// Drop _getIconUrl first or Leaflet prepends its auto-detected imagePath to these URLs.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Leaflet measures its container once on init and caches the tile grid to
// that size; it doesn't notice later CSS-driven resizes (header wrapping,
// the discover page's full-bleed layout settling, a devtools viewport
// change) on its own, which leaves stale tiles and blank space until a
// manual invalidateSize(). Watch the container and nudge it whenever it
// actually resizes.
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// Smoothly pans/zooms to a new center instead of the caller remounting the
// whole map (which used to cause a hard jump-cut to the new area). Skips
// the very first render since MapContainer's own center/zoom props already
// place it there on mount.
function FlyToOnChange({ center, zoom }) {
  const map = useMap();
  const isFirstRender = useRef(true);
  const key = `${center[0]},${center[1]},${zoom}`;
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    map.flyTo(center, zoom, { duration: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export default function EventMap({
  events = [],
  center = [40.7359, -74.0036],
  zoom = 12,
  height = 400,
  onSelectEvent,
}) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height, width: "100%" }}>
      <InvalidateOnResize />
      <FlyToOnChange center={center} zoom={zoom} />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {events.map((e) => (
        <Marker
          key={e.event_id}
          position={[e.latitude, e.longitude]}
          eventHandlers={onMarkerClick ? { click: () => onMarkerClick(e) } : undefined}
        >
          <Popup>
            {renderPopup ? (
              renderPopup(e)
            ) : (
              <>
                <strong>{e.title}</strong>
                <br />
                {new Date(e.event_date).toLocaleString()}
                <br />
                <Link to={`/events/${e.event_id}`}>Details &amp; RSVP</Link>
              </>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
