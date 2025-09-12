import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface AudioPlayerProps {
  audioUrl: string;
  candidateName?: string;
  title?: string;
  className?: string;
}

export function AudioPlayer({ audioUrl, candidateName, title = "Interview Recording", className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  // Initialize audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Set up event listeners
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      setError(null);
    };
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleError = () => {
      setIsLoading(false);
      setError("Failed to load audio recording");
      toast({
        title: "Audio Error",
        description: "Unable to load the audio recording. Please try again.",
        variant: "destructive",
      });
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl, toast]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      toast({
        title: "Playback Error",
        description: "Unable to play the audio recording.",
        variant: "destructive",
      });
    }
  };

  const handleSeek = (newTime: number[]) => {
    const audio = audioRef.current;
    if (audio && newTime[0] !== undefined) {
      audio.currentTime = newTime[0];
      setCurrentTime(newTime[0]);
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    if (newVolume[0] !== undefined) {
      setVolume(newVolume[0]);
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const restart = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const downloadAudio = () => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `${candidateName || 'candidate'}_interview_recording.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (time: number): string => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getPlaybackProgress = (): number => {
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  };

  if (error) {
    return (
      <Card className={`p-6 border-2 border-destructive/20 bg-destructive/5 ${className}`}>
        <div className="text-center">
          <div className="text-destructive font-semibold mb-2">Audio Loading Error</div>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={downloadAudio}
            data-testid="download-audio-fallback"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Recording
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 ${className}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary flex items-center">
            <Volume2 className="h-5 w-5 mr-2" />
            {title}
          </h3>
          {candidateName && (
            <p className="text-sm text-muted-foreground mt-1">
              Interview with {candidateName}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs">
            {formatTime(duration)}
          </Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={downloadAudio}
            data-testid="download-audio"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration - currentTime)} remaining</span>
        </div>
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={1}
          onValueChange={handleSeek}
          className="w-full"
          disabled={isLoading || !duration}
          data-testid="audio-progress-slider"
        />
        <div className="mt-1 bg-muted-foreground/20 rounded-full h-1">
          <div 
            className="bg-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${getPlaybackProgress()}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="default"
            size="sm"
            onClick={togglePlay}
            disabled={isLoading || !!error}
            data-testid="audio-play-pause"
            className="min-w-[80px]"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : isPlaying ? (
              <>
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                Play
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={restart}
            disabled={isLoading || !duration}
            data-testid="audio-restart"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume Controls */}
        <div className="flex items-center space-x-2 min-w-[120px]">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMute}
            data-testid="audio-mute"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.1}
            onValueChange={handleVolumeChange}
            className="w-16"
            data-testid="volume-slider"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">Loading audio recording...</p>
        </div>
      )}
    </Card>
  );
}