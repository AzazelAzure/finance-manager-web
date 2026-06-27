import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import "./legal.css";

type Props = {
  title: string;
  children: ReactNode;
};

export function LegalPageShell({ title, children }: Props): ReactNode {
  return (
    <article className="legal-page">
      <Link to="/" className="legal-page__back">
        ← Home
      </Link>
      <h1 className="legal-page__title">{title}</h1>
      <div className="legal-page__content">{children}</div>
    </article>
  );
}
