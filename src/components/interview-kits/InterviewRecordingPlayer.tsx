'use client';

import { useState, useRef, useEffect } from 'react';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowDownTrayIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ForwardIcon,
  BackwardIcon,
} from '@heroicons/react/24/solid';
import { MicrophoneIcon } from '@heroicons/react/24/outline';
import { TalkTimeBar } from '@/components/interviews/TalkTimeBar';

interface TalkTimeData {
  interviewerPercent: number;
  candidatePercent: number;
  interviewerSeconds: number;
  candidateSeconds: number;
  isBalanced: boolean;
}

interface InterviewRecordingPlayerProps {
  videoUrl?: string | null;
  audioUrl?: string | null;
  duration?: number | null;
  status: string;
  recordedAt?: string | null;
  onTimeUpdate?: (time: number) => void;
  onSeek?: (time: number) => void;
  seekTo?: number | null;
  onPlayStateChange?: (isPlaying: boolean) => void;
  interviewId?: string;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function InterviewRecordingPlayer({
  videoUrl,
  audioUrl,
  duration,
  status,
  recordedAt,
  onTimeUpdate,
  onSeek,
  seekTo,
  onPlayStateChange,
  interviewId,
}: InterviewRecordingPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [talkTimeData, setTalkTimeData] = useState<TalkTimeData | null>(null);

  const isVideo = !!videoUrl;
  const mediaUrl = videoUrl || audioUrl;

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const handleTimeUpdate = () => {
      setCurrentTime(media.currentTime);
      onTimeUpdate?.(media.currentTime);
    };

    const handleLoadedMetadata = () => {
      setMediaDuration(media.duration);
      setIsLoading(false);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    media.addEventListener('timeupdate', handleTimeUpdate);
    media.addEventListener('loadedmetadata', handleLoadedMetadata);
    media.addEventListener('play', handlePlay);
    media.addEventListener('pause', handlePause);
    media.addEventListener('waiting', handleWaiting);
    media.addEventListener('canplay', handleCanPlay);

    return () => {
      media.removeEventListener('timeupdate', handleTimeUpdate);
      media.removeEventListener('loadedmetadata', handleLoadedMetadata);
      media.removeEventListener('play', handlePlay);
      media.removeEventListener('pause', handlePause);
      media.removeEventListener('waiting', handleWaiting);
      media.removeEventListener('canplay', handleCanPlay);
    };
  }, [onTimeUpdate]);

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Handle external seek requests (e.g., from transcript viewer)
  useEffect(() => {
    if (seekTo !== null && seekTo !== undefined && mediaRef.current) {
      mediaRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
      // Auto-play when seeking from transcript
      if (mediaRef.current.paused) {
        mediaRef.current.play();
      }
    }
  }, [seekTo]);

  // Notify parent of play state changes
  useEffect(() => {
    onPlayStateChange?.(isPlaying);
  }, [isPlaying, onPlayStateChange]);

  // Fetch talk-time data when interviewId is provided
  useEffect(() => {
    if (!interviewId) return;
    let cancelled = false;
    fetch(`/api/interviews/${interviewId}/talk-time`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data) {
          setTalkTimeData(data);
        }
      })
      .catch(() => {
        // Silently ignore — don't show talk-time bar if fetch fails
      });
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
    } else {
      mediaRef.current.play();
    }
  };

  const toggleMute = () => {
    if (!mediaRef.current) return;
    mediaRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.volume = newVolume;
    }
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = time;
    }
    setCurrentTime(time);
    onSeek?.(time);
  };

  const skipForward = () => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = Math.min(
        mediaRef.current.currentTime + 15,
        mediaDuration
      );
    }
  };

  const skipBackward = () => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = Math.max(
        mediaRef.current.currentTime - 15,
        0
      );
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      await containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle processing states
  if (status === 'PENDING' || status === 'DOWNLOADING') {
    return (
      <div className="bg-gray-900 rounded-xl p-12 text-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-white text-lg font-medium">
            {status === 'PENDING' ? 'Waiting for recording...' : 'Downloading recording...'}
          </p>
          <p className="text-gray-400 text-sm mt-2">
            This may take a few minutes
          </p>
        </div>
      </div>
    );
  }

  if (status === 'TRANSCRIBING') {
    return (
      <div className="bg-gray-900 rounded-xl p-12 text-center">
        <div className="flex flex-col items-center">
          <MicrophoneIcon className="w-12 h-12 text-purple-400 mb-4 animate-pulse" />
          <p className="text-white text-lg font-medium">Transcribing audio...</p>
          <p className="text-gray-400 text-sm mt-2">
            AI is processing the interview recording
          </p>
        </div>
      </div>
    );
  }

  if (status === 'FAILED') {
    return (
      <div className="bg-danger-50 border border-danger-200 rounded-xl p-12 text-center">
        <p className="text-danger-700 text-lg font-medium">Recording failed to process</p>
        <p className="text-danger-500 text-sm mt-2">
          Please contact support if this issue persists
        </p>
      </div>
    );
  }

  if (!mediaUrl) {
    return (
      <div className="bg-gray-100 rounded-xl p-12 text-center">
        <p className="text-gray-500">No recording available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`bg-gray-900 rounded-xl overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      {/* Media Element */}
      {isVideo ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={mediaUrl}
          className="w-full"
          style={{ maxHeight: isFullscreen ? '100vh' : '500px' }}
          onClick={togglePlay}
        />
      ) : (
        <div className="p-8 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="text-center">
            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <MicrophoneIcon className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-white text-lg font-medium">Audio Recording</p>
            {recordedAt && (
              <p className="text-gray-400 text-sm mt-1">
                {new Date(recordedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={mediaUrl}
            className="hidden"
          />
        </div>
      )}

      {/* Controls */}
      <div className="bg-gray-800 px-4 py-3">
        {/* Progress Bar */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-white text-sm w-12 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={mediaDuration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <span className="text-white text-sm w-12">
            {formatTime(mediaDuration)}
          </span>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Skip Back */}
            <button
              onClick={skipBackward}
              className="p-2 text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Skip 15s back"
            >
              <BackwardIcon className="w-5 h-5" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-3 bg-white text-gray-900 rounded-full hover:bg-gray-200 transition-colors"
            >
              {isPlaying ? (
                <PauseIcon className="w-6 h-6" />
              ) : (
                <PlayIcon className="w-6 h-6" />
              )}
            </button>

            {/* Skip Forward */}
            <button
              onClick={skipForward}
              className="p-2 text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Skip 15s forward"
            >
              <ForwardIcon className="w-5 h-5" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={toggleMute}
                className="p-2 text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <SpeakerXMarkIcon className="w-5 h-5" />
                ) : (
                  <SpeakerWaveIcon className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Playback Speed */}
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="bg-gray-700 text-white text-sm px-3 py-1.5 rounded-lg border-0 cursor-pointer"
            >
              {PLAYBACK_SPEEDS.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}x
                </option>
              ))}
            </select>

            {/* Download */}
            <a
              href={mediaUrl}
              download
              className="p-2 text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Download"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
            </a>

            {/* Fullscreen (video only) */}
            {isVideo && (
              <button
                onClick={toggleFullscreen}
                className="p-2 text-white hover:bg-gray-700 rounded-lg transition-colors"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="w-5 h-5" />
                ) : (
                  <ArrowsPointingOutIcon className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Talk Time Bar */}
      {talkTimeData && (
        <div className="bg-gray-800 px-4 pb-3">
          <TalkTimeBar
            interviewerPercent={talkTimeData.interviewerPercent}
            candidatePercent={talkTimeData.candidatePercent}
            interviewerSeconds={talkTimeData.interviewerSeconds}
            candidateSeconds={talkTimeData.candidateSeconds}
            isBalanced={talkTimeData.isBalanced}
            compact
          />
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && mediaUrl && (
        <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
