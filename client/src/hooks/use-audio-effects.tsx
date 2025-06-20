import { useEffect } from 'react';
import { useAudio } from './use-audio';

export function useAudioEffects() {
  const { playSoundEffect } = useAudio();

  // Button hover effects
  const playButtonHover = () => playSoundEffect('button_hover');
  
  // Success sounds
  const playLoginSuccess = () => playSoundEffect('login_success');
  const playCheckoutComplete = () => playSoundEffect('checkout_complete');
  const playCheckIn = () => playSoundEffect('check_in');
  
  // Notification sounds
  const playNotification = () => playSoundEffect('notification');
  const playError = () => playSoundEffect('error');

  return {
    playButtonHover,
    playLoginSuccess,
    playCheckoutComplete,
    playCheckIn,
    playNotification,
    playError,
  };
}

// Hook for automatic page-based ambient changes
export function usePageAmbient(pageName: string) {
  const { playAmbient } = useAudio();

  useEffect(() => {
    const ambientMap: Record<string, string> = {
      'auth': 'sacred_grove',
      'dashboard': 'thermal_springs',
      'packages': 'roman_forum',
      'checkout': 'tiber_river',
      'check-in': 'wolf_den',
      'admin': 'roman_forum',
    };

    const ambient = ambientMap[pageName];
    if (ambient) {
      playAmbient(ambient);
    }
  }, [pageName, playAmbient]);
}