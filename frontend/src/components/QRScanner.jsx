// Attendee scans the host's QR; decoded value is POSTed to /check-in.
import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScanner({ onScan }) {
  // Keep the latest callback in a ref so passing a fresh onScan each render
  // doesn't re-run the effect and restart the camera.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    // start() can reject (no camera / denied permission); swallow it.
    const started = scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decoded) => onScanRef.current?.(decoded),
        () => {}
      )
      .catch(() => {});
    // Stop only after start settles, so we never stop() a still-starting scanner
    // (which would reject and leave the camera stream running).
    return () => {
      started.then(() => scanner.stop().catch(() => {}));
    };
  }, []);

  return <div id="qr-reader" style={{ width: 300 }} />;
}
