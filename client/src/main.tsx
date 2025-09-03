import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Proper error handling for production
window.addEventListener('unhandledrejection', (event) => {
  // Only suppress non-critical errors in production
  if (import.meta.env.PROD && event.reason?.message?.includes('DevTools')) {
    event.preventDefault();
  }
});

// Filter out devtools-related errors that aren't actionable
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  // Only suppress known devtools errors
  if (message.includes('eruda') || message.includes('DevTools') || message.includes('__replco')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

createRoot(document.getElementById("root")!).render(<App />);
