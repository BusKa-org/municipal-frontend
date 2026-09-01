import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
  componentStack: string | null;
};

/**
 * Catches render-time crashes anywhere below it.
 *
 * Without this, React 18 unmounts the whole tree on an uncaught render error,
 * which shows up as a blank white screen with no way to navigate back.
 * Here we surface the real error (message + component stack) and offer a
 * recovery action so the app stays usable.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the console copy — it has the full, unabridged stack.
    console.error('[ErrorBoundary] Caught a render error:', error, info);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  handleReset = () => {
    this.setState({ error: null, componentStack: null });
  };

  handleReload = () => {
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/';
    }
  };

  render() {
    const { error, componentStack } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          overflow: 'auto',
          padding: 24,
          background: '#fff5f5',
          color: '#3d0a0a',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 13,
          lineHeight: 1.5,
          zIndex: 99999,
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#b3261e' }}>
          Erro ao renderizar a tela
        </h2>
        <p style={{ margin: '0 0 16px', color: '#7a1c17' }}>
          A tela quebrou durante a renderização. Detalhes abaixo.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderRadius: 6,
              background: '#b3261e',
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
          <button
            onClick={this.handleReload}
            style={{
              padding: '8px 14px',
              border: '1px solid #b3261e',
              borderRadius: 6,
              background: 'transparent',
              color: '#b3261e',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Voltar ao início
          </button>
        </div>

        <strong style={{ display: 'block', marginBottom: 4 }}>
          {error.name}: {error.message}
        </strong>

        {error.stack ? (
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: '#fff',
              border: '1px solid #f2c9c6',
              borderRadius: 6,
              padding: 12,
              margin: '12px 0',
            }}
          >
            {error.stack}
          </pre>
        ) : null}

        {componentStack ? (
          <details open>
            <summary style={{ cursor: 'pointer', marginBottom: 8 }}>
              Component stack (qual tela quebrou)
            </summary>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: '#fff',
                border: '1px solid #f2c9c6',
                borderRadius: 6,
                padding: 12,
              }}
            >
              {componentStack}
            </pre>
          </details>
        ) : null}
      </div>
    );
  }
}

export default ErrorBoundary;
