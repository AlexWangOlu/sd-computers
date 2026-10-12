import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { t } from '@/admin/i18n';

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[sd-bombs admin]', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-[13px] font-medium">{t('toast.failed')}</div>
        <div className="mono text-[11.5px] max-w-[520px]" style={{ color: 'var(--text-3)' }}>
          {this.state.error.message}
        </div>
        <button type="button" className="sc-btn mt-2" onClick={() => this.setState({ error: null })}>
          Retry
        </button>
      </div>
    );
  }
}
