import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { registerSW } from 'virtual:pwa-register';

// Registro do Service Worker com auto-update e atualização ativa
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Atualiza imediatamente e recarrega a página com a nova versão
    updateSW(true);
  },
  onOfflineReady() {
    console.info('[PWA] Aplicativo pronto para uso offline.');
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      // Checa periodicamente por nova versão (a cada 60s se o app permanecer aberto)
      setInterval(() => {
        registration.update();
      }, 60 * 1000);
    }
  },
});

// No iOS PWA (Home Screen WebClip): checar atualização sempre que o app ganhar foco
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker?.getRegistration().then((reg) => {
        reg?.update();
      });
    }
  });

  window.addEventListener('focus', () => {
    navigator.serviceWorker?.getRegistration().then((reg) => {
      reg?.update();
    });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Elemento #root não encontrado no DOM.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
