// "My RSVPs": the signed-in user's own RSVPs, independent of the map (see
// Discover.jsx for the map view). Reached via the map's overlay nav.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import QRScanner from "../components/QRScanner.jsx";

export default function RSVPs() {
  const me = useAuth();
  const [rsvps, setRsvps] = useState([]);
  const [scanningRsvpId, setScanningRsvpId] = useState(null);
  const [notice, setNotice] = useState(null);
  const checkingIn = useRef(false); // scanner fires repeatedly; only submit once

  const load = useCallback(() => {
    if (!me) return;
    api.getUserRsvps(me.user_id).then(setRsvps).catch(() => setRsvps([]));
  }, [me]);

  useEffect(load, [load]);

  async function onScan(rsvp, decoded) {
    if (checkingIn.current) return;
    checkingIn.current = true;
    try {
      await api.checkIn(rsvp.event_id, decoded);
      setNotice(`Checked in to ${rsvp.event.title} — see you there!`);
      setScanningRsvpId(null);
      load();
    } catch (err) {
      setNotice(err.message);
      checkingIn.current = false; // allow retry on a bad scan
    }
  }

  async function onCancel(rsvp) {
    setNotice(null);
    try {
      await api.updateRsvp(rsvp.rsvp_id, { status: "cancelled" });
      setNotice(`RSVP cancelled for ${rsvp.event.title}.`);
      load();
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <main>
      <h1>My RSVPs</h1>
      {notice && <p role="status">{notice}</p>}
      {rsvps.length ? (
        <ul className="plain">
          {rsvps.map((r) => (
            <li key={r.rsvp_id}>
              <Link to={`/events/${r.event_id}`}>{r.event.title}</Link> ·{" "}
              {new Date(r.event.event_date).toLocaleString()} · {r.status}
              {r.did_attend && " · ✅ attended"}
              {r.status === "going" && !r.did_attend && (
                <>
                  {" · "}
                  <button type="button" onClick={() => onCancel(r)}>
                    Cancel RSVP
                  </button>{" "}
                  <button
                    type="button"
                    onClick={() => {
                      checkingIn.current = false;
                      setScanningRsvpId((id) => (id === r.rsvp_id ? null : r.rsvp_id));
                    }}
                  >
                    {scanningRsvpId === r.rsvp_id ? "Stop scanning" : "Scan host QR to check in"}
                  </button>
                  {scanningRsvpId === r.rsvp_id && (
                    <QRScanner onScan={(decoded) => onScan(r, decoded)} />
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No RSVPs yet.</p>
      )}
    </main>
  );
}
