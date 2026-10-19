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
   * Haptic de impacto médio (ex: exclusão confirmada ou descarte)
   */
  async hapticMediumImpact(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } else if ('vibrate' in navigator) {
        navigator.vibrate(18);
      }
    } catch {
      // No-op
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
   * Haptic de erro/falha em operações de banco de dados ou rede
   */
  async hapticError(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.notification({ type: NotificationType.Error });
      } else if ('vibrate' in navigator) {
        navigator.vibrate([30, 50, 30]);
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
   * Registra listeners do @capacitor/keyboard e VisualViewport para gerenciar o estado
   * do teclado e manter a área útil da aplicação perfeitamente sincronizada,
   * bloqueando o panning indevido do WebKit no iOS PWA Standalone.
   */
  async registerKeyboardListeners(): Promise<() => void> {
    if (!Capacitor.isNativePlatform()) {
      // Fallback seguro com VisualViewport API para browsers móveis e PWAs
      const vv = window.visualViewport;
      if (!vv) return () => {};

      // Trava o scroll da janela em (0, 0) para anular o auto-scroll errático do WebKit no iOS PWA
      const resetWindowScroll = () => {
        if (window.scrollY !== 0 || window.scrollX !== 0) {
          window.scrollTo(0, 0);
        }
        if (document.documentElement.scrollTop !== 0) {
          document.documentElement.scrollTop = 0;
        }
        if (document.body.scrollTop !== 0) {
          document.body.scrollTop = 0;
        }
      };

      const updateOffset = () => {
        const activeTag = document.activeElement?.tagName;
        const isInputFocused =
          activeTag === 'INPUT' ||
          activeTag === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.isContentEditable;
        const diff = Math.max(0, window.innerHeight - vv.height);
        const isKeyboardOpen = Boolean(isInputFocused && diff > 150);

        resetWindowScroll();

        document.documentElement.style.setProperty(
          '--app-height',
          `${vv.height}px`
        );
        document.documentElement.style.setProperty(
          '--keyboard-height',
          isKeyboardOpen ? `${diff}px` : '0px'
        );

        if (isKeyboardOpen) {
          document.body.classList.add('keyboard-open');
        } else {
          document.body.classList.remove('keyboard-open');
        }
      };

      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          resetWindowScroll();
          requestAnimationFrame(resetWindowScroll);
          setTimeout(resetWindowScroll, 30);
          setTimeout(resetWindowScroll, 100);
          setTimeout(resetWindowScroll, 250);
        }
      };

      const handleBlur = () => {
        document.body.classList.remove('keyboard-open');
        document.documentElement.style.setProperty('--keyboard-height', '0px');
        resetWindowScroll();
        if (window.visualViewport) {
          document.documentElement.style.setProperty(
            '--app-height',
            `${window.visualViewport.height}px`
          );
        }
      };

      // Inicializa a altura do viewport e scroll
      updateOffset();

      vv.addEventListener('resize', updateOffset);
      vv.addEventListener('scroll', updateOffset);
      window.addEventListener('scroll', resetWindowScroll, { passive: true });
      document.addEventListener('focusin', handleFocusIn, true);
      window.addEventListener('blur', handleBlur, true);
      document.addEventListener('focusout', handleBlur);

      return () => {
        vv.removeEventListener('resize', updateOffset);
        vv.removeEventListener('scroll', updateOffset);
        window.removeEventListener('scroll', resetWindowScroll);
        document.removeEventListener('focusin', handleFocusIn, true);
        window.removeEventListener('blur', handleBlur, true);
        document.removeEventListener('focusout', handleBlur);
      };
    }

    const showSub = await Keyboard.addListener('keyboardWillShow', (info) => {
      document.body.classList.add('keyboard-open');
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${info.keyboardHeight}px`
      );
    });

    const hideSub = await Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-open');
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    });

    return () => {
      void showSub.remove();
      void hideSub.remove();
    };
  },
};
