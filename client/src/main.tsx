import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress eruda debugging tool console errors
window.addEventListener('unhandledrejection', (event) => {
  // Check if the error is from eruda.js debugging tool
  if (event.reason && 
      (event.reason.message?.includes('Failed to fetch') || 
       event.reason.toString?.().includes('Failed to fetch')) &&
      (event.reason.stack?.includes('eruda.js') || 
       event.reason.stack?.includes('__replco'))) {
    event.preventDefault(); // Suppress the error
    return;
  }
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
