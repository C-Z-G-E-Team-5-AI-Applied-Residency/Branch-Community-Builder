import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import EventCard from "./EventCard.jsx";

const event = {
  event_id: 1,
  title: "Sunrise Hike",
  event_date: "2027-01-01T18:00:00Z",
  location: "New York, NY",
};

const renderCard = (props) =>
  render(
    <MemoryRouter>
      <EventCard {...props} />
    </MemoryRouter>
  );

describe("EventCard", () => {
  it("renders the event title and location", () => {
    renderCard({ event });
    expect(screen.getByText("Sunrise Hike")).toBeInTheDocument();
    expect(screen.getByText(/New York, NY/)).toBeInTheDocument();
  });

  it("shows the recommendation reason when one is given", () => {
    renderCard({ event, reason: "matches your intent" });
    expect(screen.getByText(/matches your intent/)).toBeInTheDocument();
  });

  it("links to the event by default", () => {
    renderCard({ event });
    expect(screen.getByRole("link", { name: "Sunrise Hike" })).toHaveAttribute("href", "/events/1");
  });

  it("renders the title as plain text when link is false", () => {
    renderCard({ event, link: false });
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Sunrise Hike")).toBeInTheDocument();
  });

  it("renders nothing without an event", () => {
    const { container } = renderCard({ event: null });
    expect(container).toBeEmptyDOMElement();
  });
});
