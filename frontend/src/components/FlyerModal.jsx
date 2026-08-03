// Full-size, print-friendly flyer view. Portaled to document.body so the
// print stylesheet can hide #root entirely and print just this modal.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { formatEventDateTime } from "../formatDate.js";
import FlyerDisplay from "./FlyerDisplay.jsx";

export default function FlyerModal({ event, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="flyer-modal-backdrop" onClick={onClose}>
      <div className="flyer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flyer-modal-image-wrap">
          <FlyerDisplay event={event} className="flyer-modal-image" />
          <div className="flyer-modal-overlay-text">
            <strong>{event.title}</strong>
            <div>{formatEventDateTime(event.event_date)}</div>
            <div>{event.location}</div>
          </div>
        </div>
        <div className="flyer-modal-actions flyer-modal-no-print">
          <button type="button" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
