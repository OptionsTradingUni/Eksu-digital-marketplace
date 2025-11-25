import { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Copy, Mail } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
  emailSent: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: "", emailSent: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: error.message, emailSent: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    const errorDetails = `${error.message}\n\nComponent Stack:${errorInfo.componentStack}`;
    
    this.setState({
      error,
      errorInfo: errorDetails,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send error to backend for logging and email notification
    this.reportError(error, errorInfo);
  }

  reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      const response = await fetch("/api/errors/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });
      
      if (response.ok) {
        this.setState({ emailSent: true });
      }
    } catch (err) {
      console.error("Failed to report error:", err);
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: "", emailSent: false });
  };

  copyToClipboard = () => {
    if (this.state.errorInfo) {
      navigator.clipboard.writeText(this.state.errorInfo);
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-6 w-6" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                The application encountered an error. Don't worry - the error has been logged
                {this.state.emailSent && " and we've been notified via email"}.
              </p>

              {this.state.emailSent && (
                <div className="bg-muted/50 p-3 rounded-md flex items-start gap-2">
                  <Mail className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Email notification sent to the development team with full error details.
                  </p>
                </div>
              )}
              
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-semibold">
                  Technical Details
                </summary>
                <div className="mt-2 space-y-2">
                  <div className="flex justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={this.copyToClipboard}
                      data-testid="button-copy-error"
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <pre className="p-3 bg-muted rounded-md overflow-auto text-xs max-h-64">
                    {this.state.errorInfo}
                  </pre>
                </div>
              </details>

              <div className="flex flex-wrap gap-2">
                <Button onClick={this.handleReset} variant="outline" data-testid="button-try-again">
                  Try Again
                </Button>
                <Button onClick={this.handleReload} variant="default" data-testid="button-reload-page">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
                <Button onClick={this.handleGoHome} variant="secondary" data-testid="button-go-home">
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
