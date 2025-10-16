import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handler to suppress benign third-party errors from ElevenLabs widget
function handleBenignError(event: ErrorEvent | PromiseRejectionEvent) {
  const message = 'message' in event ? event.message : (event.reason?.message || String(event.reason || ''))
  const filename = 'filename' in event ? event.filename : ''
  
  // Check for known benign errors from ElevenLabs/AudioWorklet
  const benignPatterns = [
    'raw-audio-processor',
    'AudioWorklet',
    'AudioContext',
    'worklet',
    'unpkg.com/@elevenlabs/convai-widget-embed',
    'AbortError',
    'NotAllowedError', 
    'NotFoundError',
    'SecurityError',
    'The user aborted a request',
    'play() request was interrupted',
    'Failed to load the raw-audio-processor worklet module'
  ]
  
  const isBenignError = benignPatterns.some(pattern => 
    message.includes(pattern) || filename.includes(pattern)
  )
  
  if (isBenignError) {
    console.debug('🔇 Suppressing benign third-party error:', message)
    event.preventDefault?.()
    event.stopImmediatePropagation?.()
    return true
  }
  
  return false
}

// Register global error handlers BEFORE rendering to catch early errors
window.addEventListener('error', (event) => {
  // Suppress 401 errors from unauthenticated users
  const message = event.message || '';
  if (message.includes('401') || message.includes('Unauthorized')) {
    console.debug('🔇 Suppressing 401 error from unauthenticated user');
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
  return handleBenignError(event);
}, true);

window.addEventListener('unhandledrejection', (event) => {
  // Suppress 401 errors from unauthenticated users
  const reason = String(event.reason || '');
  if (reason.includes('401') || reason.includes('Unauthorized')) {
    console.debug('🔇 Suppressing 401 promise rejection from unauthenticated user');
    event.preventDefault();
    return true;
  }
  return handleBenignError(event);
}, true);

// Add a catch-all error boundary for React
window.onerror = function(message, source, lineno, colno, error) {
  const errorMessage = String(message || error?.message || '');
  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
    console.debug('🔇 Suppressing 401 error via window.onerror');
    return true; // Prevent default handling
  }
  return false; // Allow normal error handling
};

createRoot(document.getElementById("root")!).render(<App />);
