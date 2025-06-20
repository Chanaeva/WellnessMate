import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AudioContextType {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTrack: string | null;
  playAmbient: (track: string) => void;
  playSoundEffect: (effect: string) => void;
  togglePlayback: () => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

// Mythological sound themes
const AMBIENT_TRACKS = {
  tiber_river: '/audio/ambient/tiber-river-flow.mp3',
  roman_forum: '/audio/ambient/ancient-forum-whispers.mp3',
  sacred_grove: '/audio/ambient/sacred-grove-winds.mp3',
  thermal_springs: '/audio/ambient/thermal-springs-bubbling.mp3',
  wolf_den: '/audio/ambient/wolf-den-serenity.mp3'
};

const SOUND_EFFECTS = {
  login_success: '/audio/effects/roman-bell-triumph.mp3',
  checkout_complete: '/audio/effects/coin-offering.mp3',
  check_in: '/audio/effects/temple-chime.mp3',
  button_hover: '/audio/effects/scroll-rustle.mp3',
  notification: '/audio/effects/wolf-howl-gentle.mp3',
  error: '/audio/effects/marble-crack.mp3'
};

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.3);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [ambientAudio, setAmbientAudio] = useState<HTMLAudioElement | null>(null);

  // Initialize with thermal springs ambient sound
  useEffect(() => {
    const audio = new Audio(AMBIENT_TRACKS.thermal_springs);
    audio.loop = true;
    audio.volume = volume;
    setAmbientAudio(audio);
    setCurrentTrack('thermal_springs');

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Update volume when changed
  useEffect(() => {
    if (ambientAudio) {
      ambientAudio.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, ambientAudio]);

  const playAmbient = (track: string) => {
    if (!ambientAudio || !AMBIENT_TRACKS[track as keyof typeof AMBIENT_TRACKS]) return;

    ambientAudio.pause();
    ambientAudio.src = AMBIENT_TRACKS[track as keyof typeof AMBIENT_TRACKS];
    ambientAudio.volume = isMuted ? 0 : volume;
    
    if (isPlaying) {
      ambientAudio.play().catch(console.warn);
    }
    
    setCurrentTrack(track);
  };

  const playSoundEffect = (effect: string) => {
    if (isMuted || !SOUND_EFFECTS[effect as keyof typeof SOUND_EFFECTS]) return;

    const audio = new Audio(SOUND_EFFECTS[effect as keyof typeof SOUND_EFFECTS]);
    audio.volume = volume * 0.7; // Sound effects slightly quieter than ambient
    audio.play().catch(console.warn);
  };

  const togglePlayback = () => {
    if (!ambientAudio) return;

    if (isPlaying) {
      ambientAudio.pause();
    } else {
      ambientAudio.play().catch(console.warn);
    }
    
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const setVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
  };

  return (
    <AudioContext.Provider value={{
      isPlaying,
      isMuted,
      volume,
      currentTrack,
      playAmbient,
      playSoundEffect,
      togglePlayback,
      toggleMute,
      setVolume,
    }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}