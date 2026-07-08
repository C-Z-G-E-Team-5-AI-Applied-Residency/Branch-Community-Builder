// Bottom-right About / Contact links, per wireframe.
// Hidden on the sign-in page — there they live in the top nav and the map fills the fold.
import { useLocation } from "react-router-dom";

export default function Footer() {
  const { pathname } = useLocation();
  if (pathname === "/signin") return null;
  return (
    <footer className="app-footer">
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </footer>
  );
}
