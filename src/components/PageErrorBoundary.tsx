import { Component, type ErrorInfo, type ReactNode } from "react";

interface PageErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface PageErrorBoundaryState {
  error?: Error;
}

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SocialFlow page failed to render", error, info);
  }

  componentDidUpdate(previous: PageErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: undefined });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="panel page-error-boundary" role="alert">
        <span>PAGE RECOVERY</span>
        <h2>This page could not finish loading</h2>
        <p>Your content and local data are safe. Reload this page or return to the dashboard.</p>
        <small>{this.state.error.message}</small>
        <div>
          <button type="button" className="secondary-button" onClick={() => window.location.assign("/")}>Dashboard</button>
          <button type="button" className="solid-button" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </section>
    );
  }
}
