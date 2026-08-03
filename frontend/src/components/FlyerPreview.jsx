// Renders a built-in flyer template as inline SVG so background/text
// color/font can be driven live by props instead of being baked into a
// static image. Decorative icon/divider colors stay fixed per template —
// only the background fill and the title/date/location/footer text are
// dynamic. Same 600x800 layout coordinates the original static SVGs used.
import { useId } from "react";
import {
  FLYER_TEMPLATES_BY_ID,
  FLYER_BACKGROUNDS_BY_ID,
  FLYER_FONTS_BY_ID,
} from "../flyerTemplates.js";

function ClassicIcon() {
  return (
    <>
      <circle cx="300" cy="220" r="70" fill="#dbe7d3" />
      <circle cx="300" cy="196" r="24" fill="#7c9473" />
      <path d="M254 250c8-28 26-40 46-40s38 12 46 40a70 70 0 0 1-92 0z" fill="#7c9473" />
    </>
  );
}

// "Gathering" — three overlapping circles, like people standing together.
function Community1Icon() {
  return (
    <>
      <circle cx="255" cy="230" r="46" fill="#f0c9a6" />
      <circle cx="345" cy="230" r="46" fill="#f0c9a6" />
      <circle cx="300" cy="205" r="52" fill="#c97b4a" />
    </>
  );
}

// "Block Party" — a little rooftop skyline.
function Community2Icon() {
  return (
    <>
      <rect x="180" y="220" width="60" height="60" fill="#e8c4a0" />
      <polygon points="180,220 210,180 240,220" fill="#b5563c" />
      <rect x="255" y="195" width="90" height="85" fill="#f0c9a6" />
      <polygon points="255,195 300,145 345,195" fill="#b5563c" />
      <rect x="360" y="220" width="60" height="60" fill="#e8c4a0" />
      <polygon points="360,220 390,180 420,220" fill="#b5563c" />
    </>
  );
}

// "Leaf & Branch" — a curved branch with a few leaves.
function Nature1Icon() {
  return (
    <>
      <path d="M180 260 Q300 160 420 260" fill="none" stroke="#5c8a52" strokeWidth="4" />
      <path d="M230 240c10-22 30-30 40-14s-8 34-40 14z" fill="#a8c49a" />
      <path d="M300 205c10-22 30-30 40-14s-8 34-40 14z" fill="#5c8a52" />
      <path d="M370 240c10-22 30-30 40-14s-8 34-40 14z" fill="#a8c49a" />
    </>
  );
}

// "Sunrise Trail" — a rising sun over a two-peak mountain silhouette.
function Nature2Icon() {
  return (
    <>
      <path d="M220 260 A80 80 0 0 1 380 260" fill="#f4c98a" />
      <path d="M300 150v20M240 180l14 16M360 180l-14 16" stroke="#e0a458" strokeWidth="4" strokeLinecap="round" />
      <polygon points="170,260 250,190 300,240 360,180 430,260" fill="#4a6b57" />
    </>
  );
}

const ICON_BY_TEMPLATE = {
  classic: ClassicIcon,
  community1: Community1Icon,
  community2: Community2Icon,
  nature1: Nature1Icon,
  nature2: Nature2Icon,
};

function PatternTile({ backgroundId, accent }) {
  if (backgroundId === "pattern-dots") return <circle cx="20" cy="20" r="4" fill={accent} />;
  if (backgroundId === "pattern-stripes") {
    return <line x1="0" y1="40" x2="40" y2="0" stroke={accent} strokeWidth="6" />;
  }
  // pattern-leaves
  return <path d="M12 30c2-10 10-16 18-16s16 6 18 16c-8 6-28 6-36 0z" fill={accent} />;
}

// SVG <text> doesn't wrap — an unclipped long title runs off the 600-unit
// viewBox and gets cut off by the viewport instead of failing gracefully.
function truncateTitle(title, max = 28) {
  return title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title;
}

function backgroundFill(background, uid) {
  if (background.kind === "solid") return { defs: null, fill: background.value };

  if (background.kind === "gradient") {
    const gradId = `flyer-grad-${uid}`;
    return {
      defs: (
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={background.stops[0]} />
          <stop offset="100%" stopColor={background.stops[1]} />
        </linearGradient>
      ),
      fill: `url(#${gradId})`,
    };
  }

  const patternId = `flyer-pattern-${uid}`;
  return {
    defs: (
      <pattern id={patternId} width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill={background.base} />
        <PatternTile backgroundId={background.id} accent={background.accent} />
      </pattern>
    ),
    fill: `url(#${patternId})`,
  };
}

function CenteredLayout({ fill, color, fontFamily, title, date, location, Icon }) {
  return (
    <>
      <rect width="600" height="800" fill={fill} />
      <rect x="24" y="24" width="552" height="752" fill="none" stroke="#7c9473" strokeWidth="4" />
      <Icon />
      <text x="300" y="380" textAnchor="middle" fontFamily={fontFamily} fontSize="40" fill={color}>
        {title}
      </text>
      <line x1="150" y1="410" x2="450" y2="410" stroke="#7c9473" strokeWidth="2" />
      <text x="300" y="470" textAnchor="middle" fontFamily={fontFamily} fontSize="22" fill={color}>
        {date}
      </text>
      <text x="300" y="510" textAnchor="middle" fontFamily={fontFamily} fontSize="22" fill={color}>
        {location}
      </text>
      <text x="300" y="720" textAnchor="middle" fontFamily={fontFamily} fontSize="18" fill={color} opacity="0.85">
        Hosted with Branch
      </text>
    </>
  );
}

function BannerLayout({ fill, color, fontFamily, title, date, location }) {
  return (
    <>
      <rect width="600" height="800" fill={fill} />
      <rect y="0" width="600" height="220" fill="#7c9473" />
      <polygon points="0,220 600,180 600,220" fill="#dbe7d3" />
      <text x="300" y="130" textAnchor="middle" fontFamily={fontFamily} fontWeight="bold" fontSize="46" fill="#f4f1ea">
        YOU'RE INVITED
      </text>
      <text x="300" y="420" textAnchor="middle" fontFamily={fontFamily} fontWeight="bold" fontSize="48" fill={color}>
        {title}
      </text>
      <rect x="140" y="470" width="320" height="4" fill="#dbe7d3" />
      <text x="300" y="540" textAnchor="middle" fontFamily={fontFamily} fontSize="26" fill={color}>
        {date}
      </text>
      <text x="300" y="580" textAnchor="middle" fontFamily={fontFamily} fontSize="26" fill={color}>
        {location}
      </text>
      <text x="300" y="740" textAnchor="middle" fontFamily={fontFamily} fontSize="18" fill={color} opacity="0.85">
        Hosted with Branch
      </text>
    </>
  );
}

function LeftLayout({ fill, color, fontFamily, title, date, location }) {
  return (
    <>
      <rect width="600" height="800" fill={fill} />
      <line x1="60" y1="360" x2="150" y2="360" stroke="#7c9473" strokeWidth="3" />
      <text x="60" y="330" fontFamily={fontFamily} fontSize="42" fill={color}>
        {title}
      </text>
      <text x="60" y="440" fontFamily={fontFamily} fontSize="20" fill={color}>
        {date}
      </text>
      <text x="60" y="475" fontFamily={fontFamily} fontSize="20" fill={color}>
        {location}
      </text>
      <text x="60" y="750" fontFamily={fontFamily} fontSize="16" fill={color} opacity="0.85">
        Hosted with Branch
      </text>
    </>
  );
}

export default function FlyerPreview({
  templateId = "classic",
  backgroundId,
  textColor,
  fontId,
  title = "Event Title",
  date = "Date & Time",
  location = "Location",
  className,
}) {
  const uid = useId();
  const template = FLYER_TEMPLATES_BY_ID[templateId] || FLYER_TEMPLATES_BY_ID.classic;
  const background = FLYER_BACKGROUNDS_BY_ID[backgroundId] || FLYER_BACKGROUNDS_BY_ID["solid-cream"];
  const font = FLYER_FONTS_BY_ID[fontId] || FLYER_FONTS_BY_ID["serif-classic"];
  const { defs, fill } = backgroundFill(background, uid);
  const color = textColor || "#3f4a3a";
  const commonProps = { fill, color, fontFamily: font.css, title: truncateTitle(title), date, location };

  return (
    <svg viewBox="0 0 600 800" className={className} role="img" aria-label={`${title} flyer`}>
      {defs && <defs>{defs}</defs>}
      {template.layout === "banner" ? (
        <BannerLayout {...commonProps} />
      ) : template.layout === "left" ? (
        <LeftLayout {...commonProps} />
      ) : (
        <CenteredLayout {...commonProps} Icon={ICON_BY_TEMPLATE[template.id] || ClassicIcon} />
      )}
    </svg>
  );
}
