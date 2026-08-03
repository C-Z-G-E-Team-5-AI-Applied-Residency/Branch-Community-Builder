// Single component every flyer-showing UI renders through — resolves an
// event's flyer_* fields via resolveFlyer() and picks the right renderer,
// so upload/legacy/template flyers all "just work" from one call site.
import { apiUrl } from "../api/client.js";
import { resolveFlyer } from "../flyerTemplates.js";
import { formatEventDateTime } from "../formatDate.js";
import FlyerPreview from "./FlyerPreview.jsx";

export default function FlyerDisplay({ event, className }) {
  const flyer = resolveFlyer(event);

  if (flyer.kind === "upload") {
    return <img src={apiUrl(flyer.imgSrc)} alt="" className={className} />;
  }
  if (flyer.kind === "legacy-static") {
    return <img src={flyer.imgSrc} alt="" className={className} />;
  }
  if (flyer.kind === "template") {
    return (
      <FlyerPreview
        templateId={flyer.templateId}
        backgroundId={flyer.backgroundId}
        textColor={flyer.textColor}
        fontId={flyer.fontId}
        title={event.title}
        date={formatEventDateTime(event.event_date)}
        location={event.location}
        className={className}
      />
    );
  }
  return null;
}
