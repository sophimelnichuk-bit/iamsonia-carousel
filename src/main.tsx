import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerOpenFont } from './lib/fonts';
import './index.css';

registerOpenFont();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
