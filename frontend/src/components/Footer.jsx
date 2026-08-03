// Bottom-right About / Contact links, per wireframe.
// Hidden on the sign-in page — there they live in the top nav and the map fills the fold.
import { Link, useLocation } from "react-router-dom";

export default function Footer() {
  const { pathname } = useLocation();
  if (pathname === "/signin") return null;
  return (
    <footer className="app-footer">
      <Link to="/about">About</Link>
      <Link to="/contact">Contact</Link>
    </footer>
  );
}
