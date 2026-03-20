/**
 * SafeWidget — Error boundary wrapper for Dashboard widgets
 * Prevents a single broken widget from crashing the entire Dashboard
 */
import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class SafeWidget extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message };
  }

  componentDidCatch(error: Error) {
    console.warn(`[SafeWidget] ${this.props.name || "Widget"} crashed:`, error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          borderRadius: 14, padding: 16, marginBottom: 20,
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.2)",
          textAlign: "center",
          color: "#94a3b8",
          fontSize: 13,
        }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <p style={{ margin: "6px 0 0" }}>
            {this.props.name || "Widget"} โหลดไม่สำเร็จ
          </p>
          <button
            onClick={() => this.setState({ hasError: false, errorMsg: "" })}
            style={{
              marginTop: 8, padding: "4px 14px", borderRadius: 8,
              border: "1px solid rgba(239,68,68,0.3)", background: "transparent",
              color: "#ef4444", fontSize: 11, cursor: "pointer",
            }}
          >
            🔄 ลองใหม่
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
