import React, { Suspense, lazy } from "react";
import ErrorBoundary from "./ErrorBoundary";
import { AppProvider } from "./contexts/AppContext";
import { ToastContainer } from "./components/ToastContainer";
import LoadingSpinner from "./components/LoadingSpinner";

const NisanAlbum = lazy(() => 
  import(/* webpackPrefetch: true */ "./NisanAlbum").then(module => ({
    default: module.default
  }))
);

export default function App() {
  const logEvent = (eventName, params = {}) => {
    if (import.meta.env.PROD) {
      try {
        const analyticsData = {
          event: eventName,
          params: { 
            ...params, 
            timestamp: new Date().toISOString(),
          }
        };
        console.log('Analytics Event:', analyticsData);
      } catch (e) {}
    }
  };

  return (
    <AppProvider>
      <ErrorBoundary logEvent={logEvent}>
        <div className="min-h-screen bg-gradient-to-b from-[#f8f5f1] to-[#fdfdfd] flex flex-col">
          {/* Toast bildirimleri */}
          <ToastContainer />
          
          {/* Fotoğraf Yükleme & Albüm */}
          <main className="w-full max-w-5xl mx-auto px-4 flex-1">
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="large" />
              </div>
            }>
              <NisanAlbum />
            </Suspense>
          </main>

          {/* Footer */}
          <footer className="py-6 text-center text-gray-500 text-sm">
            © 2025 Anıl & Pelin Nişan Albümü
          </footer>
        </div>
      </ErrorBoundary>
    </AppProvider>
  );
}