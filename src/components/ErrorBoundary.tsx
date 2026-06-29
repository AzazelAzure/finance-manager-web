import { Component, type ErrorInfo, type ReactNode } from "react";
import { getLocale, tr } from "../lib/i18n";
import { Button } from "./ui/Button";
import { ErrorState } from "./ui/ErrorState";

type Props = {
  children: ReactNode;
  /** When any value changes, clear the caught error (e.g. route pathname). */
  resetKeys?: readonly unknown[];
};

type State = {
  error: Error | null;
};

function keysEqual(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => Object.is(value, b[index]));
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.state.error && !keysEqual(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Uncaught render error", error, info.componentStack);
  }

  private clearError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    const locale = getLocale();
    return (
      <div className="stack" style={{ padding: "1rem 0" }}>
        <ErrorState
          title={tr("errorBoundary.title", locale)}
          description={error.message || tr("errorBoundary.description", locale)}
          onRetry={this.clearError}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
            {tr("errorBoundary.reload", locale)}
          </Button>
          <Button type="button" variant="ghost" onClick={() => { window.location.href = "/app/dashboard"; }}>
            {tr("errorBoundary.goDashboard", locale)}
          </Button>
        </div>
      </div>
    );
  }
}
