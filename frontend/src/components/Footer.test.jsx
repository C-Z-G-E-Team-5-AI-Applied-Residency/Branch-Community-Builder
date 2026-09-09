import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Footer from "./Footer.jsx";

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Footer />
    </MemoryRouter>
  );

describe("Footer", () => {
  it("shows About and Contact links", () => {
    renderAt("/discover");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
  });

  it("is hidden on the sign-in page", () => {
    const { container } = renderAt("/signin");
    expect(container).toBeEmptyDOMElement();
  });
});
