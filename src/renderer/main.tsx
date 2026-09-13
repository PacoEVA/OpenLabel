import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

