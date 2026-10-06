import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { startAutoSync } from './sync/syncService';
import './styles.css';
import './styles-lists.css';
import './styles-session.css';

// Service worker : mise en cache hors ligne et mise à jour automatique
registerSW({ immediate: true });

// Synchronisation entre appareils (si activée dans les réglages)
startAutoSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
