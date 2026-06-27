import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Helmet } from "react-helmet-async";
import { LegalPageShell } from "../../layout/LegalPageShell";
import tosContent from "../../content/legal/tos.md?raw";
import type { ReactNode } from "react";

export function TermsPage(): ReactNode {
  return (
    <LegalPageShell title="Terms of Service">
      <Helmet>
        <title>Terms of Service | The Hive Financial Manager</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{tosContent}</ReactMarkdown>
    </LegalPageShell>
  );
}
