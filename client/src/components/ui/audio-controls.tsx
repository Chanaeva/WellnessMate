import { useState } from 'react';
import { useAudio } from '@/hooks/use-audio';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Volume2, VolumeX, Play, Pause, Music } from 'lucide-react';

const AMBIENT_OPTIONS = [
  { value: 'thermal_springs', label: 'Thermal Springs', description: 'Bubbling sacred waters' },
  { value: 'tiber_river', label: 'Tiber River', description: 'Flowing ancient currents' },
  { value: 'sacred_grove', label: 'Sacred Grove', description: 'Whispering forest winds' },
  { value: 'roman_forum', label: 'Roman Forum', description: 'Echoes of antiquity' },
  { value: 'wolf_den', label: 'Wolf Den', description: 'Protective serenity' },
];

export function AudioControls() {
  const { 
    isPlaying, 
    isMuted, 
    volume, 
    currentTrack, 
    playAmbient, 
    togglePlayback, 
    toggleMute, 
    setVolume 
  } = useAudio();

  const [isOpen, setIsOpen] = useState(false);

  const handleVolumeChange = (values: number[]) => {
    setVolume(values[0]);
  };

  const currentTrackInfo = AMBIENT_OPTIONS.find(option => option.value === currentTrack);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0 bg-black/10 border-moss-green/20 hover:bg-moss-green/10"
        >
          <Music className="h-4 w-4 text-moss-green" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="text-center">
            <h4 className="font-medium text-sm">Mythological Ambience</h4>
            <p className="text-xs text-muted-foreground">
              {currentTrackInfo?.description || 'Select ambient sounds'}
            </p>
          </div>

          {/* Track Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Ambient Scene</label>
            <Select value={currentTrack || ''} onValueChange={playAmbient}>
              <SelectTrigger>
                <SelectValue placeholder="Choose ambience" />
              </SelectTrigger>
              <SelectContent>
                {AMBIENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={togglePlayback}
              className="flex-1"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3 w-3 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-2" />
                  Play
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleMute}
              className="p-2"
            >
              {isMuted ? (
                <VolumeX className="h-3 w-3" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
            </Button>
          </div>

          {/* Volume Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Volume</label>
              <span className="text-xs text-muted-foreground">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={1}
              step={0.1}
              className="w-full"
            />
          </div>

          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Inspired by the ancient legends of Romulus and Remus
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}