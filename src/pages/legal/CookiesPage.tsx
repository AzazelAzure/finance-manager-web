import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Helmet } from "react-helmet-async";
import { LegalPageShell } from "../../layout/LegalPageShell";
import cookiesContent from "../../content/legal/cookies.md?raw";
import type { ReactNode } from "react";

export function CookiesPage(): ReactNode {
  return (
    <LegalPageShell title="Cookie Policy">
      <Helmet>
        <title>Cookie Policy | The Hive Financial Manager</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{cookiesContent}</ReactMarkdown>
    </LegalPageShell>
  );
}
