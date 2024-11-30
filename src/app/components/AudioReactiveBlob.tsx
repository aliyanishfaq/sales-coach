import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AudioAnalyzer } from '@/app/lib/audioAnalyzer';
import Scene from './Scene';

const AudioReactiveBlob = ({ 
  audioStream, 
  isActive = false,
  color = '#4F46E5'
}) => {
  const [intensity, setIntensity] = useState(0.3);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const animationFrameRef = useRef<number>();
  const intensityRef = useRef(0.3);

  useEffect(() => {
    if (!analyzerRef.current) {
      analyzerRef.current = new AudioAnalyzer();
      console.log('Created new AudioAnalyzer');
    }

    if (audioStream instanceof MediaStream) {
      console.log('Connecting to audio stream');
      analyzerRef.current.connectToStream(audioStream);

      const updateIntensity = () => {
        if (analyzerRef.current) {
          const volume = analyzerRef.current.getAverageVolume();
          
          const newIntensity = 0.3 + (volume * 1.2);
          
          if (Math.abs(intensityRef.current - newIntensity) > 0.005) {
            intensityRef.current = newIntensity;
            setIntensity(newIntensity);
          }
        }
        animationFrameRef.current = requestAnimationFrame(updateIntensity);
      };

      updateIntensity();
    } else {
      console.log('No audio stream available');
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (analyzerRef.current) {
        analyzerRef.current.cleanup();
      }
    };
  }, [audioStream]);

  useEffect(() => {
    console.log('Intensity updated:', intensity);
  }, [intensity]);

  return (
    <div className="w-64 h-64">
      <Scene isActive={isActive} color={color} intensity={intensity} />
    </div>
  );
};

export default dynamic(() => Promise.resolve(AudioReactiveBlob), { ssr: false });