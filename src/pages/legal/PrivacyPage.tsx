import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Helmet } from "react-helmet-async";
import { LegalPageShell } from "../../layout/LegalPageShell";
import privacyContent from "../../content/legal/privacy_policy.md?raw";
import type { ReactNode } from "react";

export function PrivacyPage(): ReactNode {
  return (
    <LegalPageShell title="Privacy Policy">
      <Helmet>
        <title>Privacy Policy | The Hive Financial Manager</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{privacyContent}</ReactMarkdown>
    </LegalPageShell>
  );
}
