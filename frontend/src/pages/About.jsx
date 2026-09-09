// About page (BR-48): tells visitors who's behind BRANCH and why it exists —
// team roster, the project proposal (pulled from the spec in README.md),
// a couple of persona walkthroughs, and a closing pitch that hands off to
// the Contact page. Sections reveal on scroll (Reveal below) so the page
// gives the reference site's "loads as you go" feel.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const TEAM = [
  {
    name: "Gabriel Cervantes",
    role: "Product Lead",
    description: "Owned product direction, keeping the team's work paced and aligned to the app's goals.",
  },
  {
    name: "Christopher Hackett",
    role: "Technical Lead",
    description: "Owned technical decision-making, stepping in to resolve blockers as they came up.",
  },
  {
    name: "Zane Correa",
    role: "Scrum Master",
    description: "Owned the scrum board, keeping deadlines and tickets on track.",
  },
  {
    name: "Emily Vu",
    role: "Support Lead",
    description: "Owned cross-stack support, contributing to design decisions and reviewing pull requests.",
  },
];

const FEATURES = [
  {
    title: "Interactive Event Map",
    description: "Browse nearby events on a live map, filtered by distance, zip code, date, or tag.",
  },
  {
    title: "RSVP & QR Check-In",
    description: "RSVP with one tap, then check in by scanning the host's QR code so attendance is proven, not just claimed.",
  },
  {
    title: "AI Event Recommendations",
    description: "Get event suggestions powered by Google Gemini, tailored to your interests and past attendance.",
  },
  {
    title: "Community Standing",
    description: "Track events hosted and attended per neighborhood, and earn leader status for showing up.",
  },
  {
    title: "Weekly Prompts & Announcements",
    description: "Keep the conversation going between events with weekly community prompts and host announcements.",
  },
];

const PERSONAS = [
  {
    name: "Maya, 24",
    blurb:
      "Active on three social apps and always \"in the group chat,\" but her actual plans with " +
      "friends keep dissolving before they happen.",
    benefit:
      "With BRANCH, Maya finds real events happening a few blocks from her apartment, RSVPs, " +
      "and checks in when she actually shows up — turning group-chat intentions into evenings " +
      "that really happen.",
  },
  {
    name: "David, 27",
    blurb:
      "Recently moved to a new city for work and knows almost no one outside his office.",
    benefit:
      "David uses the event map to find recurring meetups in his neighborhood, and BRANCH's " +
      "recommendations point him toward events that match interests he already listed on his " +
      "profile — a faster path to a community than cold-scrolling social media.",
  },
];

// Fades/slides a section in the first time it crosses into the viewport;
// disconnects immediately after so it never re-triggers on scroll-back.
function Reveal({ as: Tag = "div", className = "", children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`reveal ${visible ? "reveal-visible" : ""} ${className}`.trim()}>
      {children}
    </Tag>
  );
}

export default function About() {
  const me = useAuth();

  return (
    <main className="about-page">
      <section className="about-hero">
        <Link to="/discover" className="brand hero-logo">[ BRANCH… ]</Link>
        {!me && (
          <div className="hero-actions">
            <Link to="/signin" className="btn">Sign In</Link>
            <Link to="/signup" className="btn btn-primary">Register</Link>
          </div>
        )}
      </section>

      <h1>Who We Are</h1>
      <div className="cover-placeholder about-cover">Video coming soon</div>

      <Reveal as="section">
        <h2>The Team</h2>
        <div className="team-grid">
          {TEAM.map((member) => (
            <div className="team-member" key={member.name}>
              <h3>{member.name}</h3>
              <p className="team-role">{member.role}</p>
              <p>{member.description}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal as="section">
        <h2>The Project</h2>
        <p>
          We live in an age where anyone can have thousands of followers and still feel like they
          have no one to call. Young adults today are more connected than ever online and yet
          lonelier than ever in person. <strong>BRANCH</strong> is a community-building application
          designed to bridge that gap, giving users a way to discover local events, connect with
          people who share their interests, and show up for their communities in a real, meaningful
          way. Users can explore an interactive map of nearby events and free community resources,
          RSVP and check in to prove they actually showed up, and build a profile that reflects who
          they are beyond a screen. Our impact isn't measured in likes or followers, but in events
          created, doors walked through, and communities strengthened — one real-world connection
          at a time.
        </p>
      </Reveal>

      <Reveal as="section">
        <h2>Who It's For</h2>
        <p>
          Our audience is young adults, similar to us: people with more-than-average screen time who
          are looking to bring some of that time back into the real world. We're also building for
          people who are social online — active in group chats, social media, and messaging apps —
          but whose plans with those same connections never quite come into fruition offline.
        </p>
      </Reveal>

      <Reveal as="section">
        <h2>What Our Users Would Do</h2>
        {PERSONAS.map((p) => (
          <div className="card persona-card" key={p.name}>
            <h3>{p.name}</h3>
            <p>{p.blurb}</p>
            <p>{p.benefit}</p>
          </div>
        ))}
      </Reveal>

      <Reveal as="section">
        <h2>Features</h2>
        <p>Here's what you can already do in BRANCH:</p>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="card feature-card" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal as="section">
        <h2>Our Goal</h2>
        <p>
          <em>Moving your community from online to outside. Real connections for a digital
          generation.</em> That's the tagline we build every feature against. Our team wants BRANCH
          to be the reason someone closes their phone and opens their front door — not another app
          competing for their attention, but the bridge that gets them back into their own
          neighborhood, meeting the people who live in it.
        </p>
      </Reveal>

      <Reveal as="p">
        Have questions or concerns? <Link to="/contact">Learn how to contact us here.</Link>
      </Reveal>
    </main>
  );
}
