import React from 'react';

interface State {
  error?: Error;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            maxWidth: '60vw',
            padding: '16px',
            background: 'rgba(20,0,0,0.92)',
            color: '#ff8a8a',
            font: '13px/1.4 monospace',
            border: '1px solid #ff5252',
            borderRadius: '6px',
            zIndex: 99999,
            whiteSpace: 'pre-wrap',
            pointerEvents: 'auto',
          }}
        >
          <b>Inventory UI error:</b>
          {'\n'}
          {this.state.error.message}
          {'\n\n'}
          {this.state.error.stack?.split('\n').slice(0, 6).join('\n')}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
