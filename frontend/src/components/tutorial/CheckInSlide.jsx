// Tutorial: simulated QR check-in. The real flow uses the camera scanner on the
// event page; we fake the scan here to avoid a camera-permission prompt mid-onboarding.
import { useEffect, useRef, useState } from "react";
import QRCode from "../QRCode.jsx";

export default function CheckInSlide() {
  const [phase, setPhase] = useState("idle"); // idle -> scanning -> done
  const timer = useRef();

  useEffect(() => () => clearTimeout(timer.current), []);

  function onPracticeScan() {
    setPhase("scanning");
    timer.current = setTimeout(() => setPhase("done"), 900);
  }

  return (
    <div>
      <p>
        When you arrive at an event, the host shows a QR code like this one.
        Scanning it from the event page checks you in — proof you actually showed up.
      </p>
      <QRCode value="branch-tutorial-demo" />
      <p>
        {phase === "done" ? (
          <span role="status">✅ Checked in — see you there!</span>
        ) : (
          <button type="button" disabled={phase === "scanning"} onClick={onPracticeScan}>
            {phase === "scanning" ? "Scanning…" : "Try a practice scan"}
          </button>
        )}
      </p>
      <p>Check-ins build your community standing and teach Branch what you actually enjoy.</p>
    </div>
  );
}
