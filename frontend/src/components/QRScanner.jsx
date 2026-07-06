// Attendee scans the host's QR; decoded value is POSTed to /check-in.
import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScanner({ onScan }) {
  const ref = useRef(null);
  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      (decoded) => onScan?.(decoded),
      () => {}
    );
    return () => scanner.stop().catch(() => {});
  }, [onScan]);
  return <div id="qr-reader" ref={ref} style={{ width: 300 }} />;
}
