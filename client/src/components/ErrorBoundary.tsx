import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      const { error, errorInfo, showDetails } = this.state;
      const fallbackMessage = this.props.fallbackMessage || 'Something went wrong loading the messenger';

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[hsl(215,28%,7%)] via-[hsl(217,32%,9%)] to-[hsl(215,28%,6%)]">
          <Card className="max-w-2xl w-full glass-panel border-[hsl(217,32%,17%,0.15)] p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-destructive/20 border border-destructive/30">
                <AlertTriangle className="w-8 h-8 text-destructive" data-testid="icon-error" />
              </div>
              <div className="flex-1 space-y-2">
                <h2 className="text-2xl font-semibold text-foreground enterprise-heading" data-testid="text-error-title">
                  Oops! Something went wrong
                </h2>
                <p className="text-muted-foreground" data-testid="text-error-message">
                  {fallbackMessage}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={this.handleReload}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[var(--glow-primary)] transition-all"
                data-testid="button-reload"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
              <Button 
                onClick={this.handleReset}
                variant="outline"
                className="flex-1 border-border hover:bg-muted/50"
                data-testid="button-retry"
              >
                Try Again
              </Button>
            </div>

            {isDev && error && (
              <div className="space-y-3 pt-4 border-t border-border">
                <button
                  onClick={this.toggleDetails}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-details"
                >
                  {showDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <span>Technical Details (Development Mode)</span>
                </button>

                {showDetails && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-muted/30 border border-border">
                      <p className="text-xs font-semibold text-destructive mb-2">Error Message:</p>
                      <pre className="text-xs text-foreground overflow-x-auto" data-testid="text-error-stack">
                        {error.toString()}
                      </pre>
                    </div>

                    {errorInfo && (
                      <div className="p-4 rounded-lg bg-muted/30 border border-border">
                        <p className="text-xs font-semibold text-destructive mb-2">Component Stack:</p>
                        <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}

                    {error.stack && (
                      <div className="p-4 rounded-lg bg-muted/30 border border-border">
                        <p className="text-xs font-semibold text-destructive mb-2">Stack Trace:</p>
                        <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
