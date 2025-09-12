import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('Error caught by boundary:', error, errorInfo);
    
    if (this.props.logEvent) {
      this.props.logEvent('error_boundary', { 
        error: error.message, 
        componentStack: errorInfo.componentStack 
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-blush p-4">
          <div className="text-center p-6 bg-white rounded-2xl shadow-card max-w-md">
            <div className="text-6xl mb-4">😢</div>
            <h2 className="text-xl font-semibold text-rose-600 mb-2">
              Bir hata oluştu
            </h2>
            <p className="text-gray-600 mb-4">
              Üzgünüz, bir şeyler yanlış gitti. Lütfen sayfayı yenileyin.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className="text-left text-sm text-gray-500 mb-4">
                <summary>Hata detayları</summary>
                <div className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-32">
                  {this.state.error && this.state.error.toString()}
                  <br />
                  {this.state.errorInfo?.componentStack}
                </div>
              </details>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}