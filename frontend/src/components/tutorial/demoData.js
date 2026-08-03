// Fake events for the onboarding tutorial slides. Never sent to the API —
// ids are strings so an accidental request would 404 loudly, not hit real data.
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

export const DEMO_EVENTS = [
  {
    event_id: "demo-hoops",
    title: "Pickup Basketball at the Park",
    event_date: daysFromNow(2),
    location: "West Village Courts",
    latitude: 40.7336,
    longitude: -74.0027,
  },
  {
    event_id: "demo-photo",
    title: "Golden Hour Photo Walk",
    event_date: daysFromNow(4),
    location: "Hudson River Greenway",
    latitude: 40.7391,
    longitude: -74.0089,
  },
  {
    event_id: "demo-garden",
    title: "Community Garden Volunteer Day",
    event_date: daysFromNow(6),
    location: "Bleecker Playground Garden",
    latitude: 40.7371,
    longitude: -74.0043,
  },
];
