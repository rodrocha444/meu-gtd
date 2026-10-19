import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.meugtd.tasks',
  appName: 'Meu GTD',
  webDir: 'dist',
  backgroundColor: '#09090b', // Evita flash branco ao iniciar no iOS/Android
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  ios: {
    contentInset: 'never', // Controle 100% via CSS env(safe-area-inset-*)
    allowsLinkPreview: false, // Bloqueia preview de links longo no WKWebView
    scrollEnabled: false, // Desativa bounce na janela raiz do WKWebView
    backgroundColor: '#09090b',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#09090b',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Body,
      style: KeyboardStyle.Dark,
      resizeOnFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
  },
};

export default config;
