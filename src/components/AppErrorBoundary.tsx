import * as React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence: an uncaught render/lifecycle error anywhere in the
 * tree previously unmounted the whole app, leaving a blank white page. This
 * boundary swaps it for a readable message and a reload button instead.
 */
class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled application error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "24px",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "20px", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#666", maxWidth: "420px", fontSize: "14px" }}>
            Suffolk Tennis hit an unexpected error. Reloading usually fixes it —
            if not, please try again shortly.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              background: "#0f1c2e",
              color: "#fff",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default AppErrorBoundary;
