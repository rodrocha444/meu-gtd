import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Ponte de Feedback Físico (Haptics), StatusBar e Teclado Nativo
 */
export const NativeBridge = {
  isNative: (): boolean => Capacitor.isNativePlatform(),

  /**
   * Haptic ao concluir tarefa (ImpactStyle.Medium conforme especificação)
   */
  async hapticTaskComplete(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } else if ('vibrate' in navigator) {
        navigator.vibrate(18);
      }
    } catch {
      // Ignora silenciosamente em dispositivos sem motor háptico
    }
  },

  /**
   * Haptic leve ao mudar prioridade, alternar abas ou atingir limiar de swipe
   */
  async hapticLightImpact(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if ('vibrate' in navigator) {
        navigator.vibrate(8);
      }
    } catch {
      // No-op
    }
  },

  /**
   * Haptic de ação de swipe confirmada ou triagem GTD
   */
  async hapticSwipeAction(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.notification({ type: NotificationType.Success });
      } else if ('vibrate' in navigator) {
        navigator.vibrate([12, 25, 15]);
      }
    } catch {
      // No-op
    }
  },

  /**
   * Sincroniza a StatusBar nativa com o tema (Dark / Light)
   */
  async syncStatusBarTheme(theme: 'dark' | 'light'): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.setStyle({
        style: theme === 'dark' ? Style.Dark : Style.Light,
      });
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({
          color: theme === 'dark' ? '#09090b' : '#ffffff',
        });
      }
    } catch {
      // No-op
    }
  },

  /**
   * Registra listeners do @capacitor/keyboard para ajustar a variável CSS --keyboard-height
   * garantindo que a barra de Quick Capture suba suavemente junto com o teclado
   */
  async registerKeyboardListeners(): Promise<() => void> {
    if (!Capacitor.isNativePlatform()) {
      // Fallback com VisualViewport API para PWA iOS/Android
      const vv = window.visualViewport;
      if (!vv) return () => {};
      const handleViewportResize = () => {
        const offset = Math.max(0, window.innerHeight - vv.height);
        document.documentElement.style.setProperty(
          '--keyboard-height',
          `${offset}px`
        );
      };
      vv.addEventListener('resize', handleViewportResize);
      return () => vv.removeEventListener('resize', handleViewportResize);
    }

    const showSub = await Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${info.keyboardHeight}px`
      );
    });

    const hideSub = await Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    });

    return () => {
      void showSub.remove();
      void hideSub.remove();
    };
  },
};
