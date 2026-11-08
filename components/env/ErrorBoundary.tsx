'use client';
// Guards a panel so an engine shape mismatch shows a message instead of blanking the tab.
import { Component, type ReactNode } from 'react';

export class PanelBoundary extends Component<{ children: ReactNode; what?: string }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return (
        <section className="panel empty">
          <span className="err">Couldn&apos;t show {this.props.what ?? 'this section'} ({this.state.err.message}).</span>
        </section>
      );
    }
    return this.props.children;
  }
}
