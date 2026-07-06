// Renders the host's check-in QR client-side from the event's check_in_code.
import { QRCodeCanvas } from "qrcode.react";
export default function QRCode({ value }) {
  return <QRCodeCanvas value={value} size={220} />;
}
