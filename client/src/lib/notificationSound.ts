// Notification Sound Manager
interface NotificationSounds {
  message: string;
  mention: string;
  dm: string;
}

// Base64 encoded simple notification sounds (beep variations)
const NOTIFICATION_SOUNDS: NotificationSounds = {
  // Simple beep for regular messages
  message: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGCz+7Uhz0HGnvH7OigTwwKXKzn7bFUFAg1kuD1y3ssD0+1+OiEyOVrAsVuTAwZfuPjdF08LHjWbwUC',
  
  // Higher pitch beep for mentions
  mention: 'data:audio/wav;base64,UklGRs4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQoFAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGCz+7Uhz0HGnvH7OigTwwKXKzn7bFUFAg1kuD1y3ssDz0wTx8KEm/k7aNLBQ5e1PnfsS4FPJzh37wwDTN8y+2nTAwUZ9r0sGAYBDyS1+fOejIMULDq8KBQHAQ+',
  
  // Double beep for DMs
  dm: 'data:audio/wav;base64,UklGRoYHAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQoHAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGCz+7Uhz0HGnvH7OigTwwKXKzn7bFUFAg1kuD1y3ssD0+1+OiEyOVrAsVuTAwZfuPjdF08LHjWbwUCkujiV1kCD2fb8sF+PQgZe+bwx4M9BR1ywOfWmUcMDGzI5+mjUxAHPJvd7cyBMwghg9vz14w6Bhd90OvpmU8NBF6v5+yuWRcGOJXb8sqALwhAq+vs1qNtw96PXQcKacno45tMDRJf1OvRkEkLGn7J6eCXRwkOZrnoq5hQCg5pudPTrGkcDEat4OuwYBsHMYnR8N2QQAoUXrTp66hVFApGn+DyvmwhBTGCz+7Uhz0HGnvH7OigTwwKXKzn7bFUFAg1kuD1y3ssGzk='
};

class NotificationSoundManager {
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;
  private volume: number = 0.5;

  constructor() {
    // Load settings from localStorage
    this.enabled = localStorage.getItem('notifications_sound_enabled') !== 'false';
    const savedVolume = localStorage.getItem('notifications_sound_volume');
    this.volume = savedVolume ? parseFloat(savedVolume) : 0.5;

    // Preload all sounds
    this.preloadSounds();
  }

  private preloadSounds() {
    Object.entries(NOTIFICATION_SOUNDS).forEach(([type, dataUri]) => {
      const audio = new Audio(dataUri);
      audio.volume = this.volume;
      this.audioCache.set(type, audio);
    });
  }

  play(type: 'message' | 'mention' | 'dm' | 'direct_message') {
    if (!this.enabled) return;

    // Map direct_message to dm
    const soundType = type === 'direct_message' ? 'dm' : type;
    
    const audio = this.audioCache.get(soundType);
    if (audio) {
      // Clone the audio to allow overlapping sounds
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = this.volume;
      clone.play().catch(err => {
        console.warn('Failed to play notification sound:', err);
      });
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem('notifications_sound_enabled', String(enabled));
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('notifications_sound_volume', String(this.volume));
    
    // Update volume for cached audio elements
    this.audioCache.forEach(audio => {
      audio.volume = this.volume;
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getVolume(): number {
    return this.volume;
  }
}

// Export singleton instance
export const notificationSound = new NotificationSoundManager();