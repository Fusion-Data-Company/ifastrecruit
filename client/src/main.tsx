import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress ALL unhandled promise rejections that cause annoying popups
window.addEventListener('unhandledrejection', (event) => {
  // Prevent all unhandled rejection popups - they're not critical for user experience
  event.preventDefault();
  // Optional: log for debugging if needed
  // console.log('Suppressed unhandled rejection:', event.reason);
});

// Suppress console errors from eruda
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  // Don't log eruda-related fetch errors
  if (message.includes('eruda.js') || 
      message.includes('__replco') || 
      (message.includes('Failed to fetch') && message.includes('devtools'))) {
    return;
  }
  originalConsoleError.apply(console, args);
};

createRoot(document.getElementById("root")!).render(<App />);
