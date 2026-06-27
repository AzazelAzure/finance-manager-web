import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import "./LegalFooter.css";

export function LegalFooter(): ReactNode {
  return (
    <footer className="legal-footer" aria-label="Legal links">
      <nav className="legal-footer__links">
        <Link to="/privacy">Privacy Policy</Link>
        <span aria-hidden>·</span>
        <Link to="/terms">Terms of Service</Link>
        <span aria-hidden>·</span>
        <Link to="/cookies">Cookie Policy</Link>
      </nav>
      <p className="legal-footer__copy">© {new Date().getFullYear()} The Hive Financial Manager</p>
    </footer>
  );
}
