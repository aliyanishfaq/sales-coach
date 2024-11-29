'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { WavRecorder, WavStreamPlayer } from '@/app/lib/wavtools';
import { VoiceVisualizer } from '../../components/VoiceVisualizer';

export default function TrainingSession({ params }: { params: { personaId: string } }) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [conversationItems, setConversationItems] = useState<ItemType[]>([]);
  const [isAITalking, setIsAITalking] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const clientRef = useRef<RealtimeClient>();
  const wavRecorderRef = useRef<WavRecorder>();
  const wavStreamPlayerRef = useRef<WavStreamPlayer>();

  const relayServerUrl = 'ws://localhost:8081'; // Adjust as necessary

  useEffect(() => {
    // Initialize RealtimeClient, WavRecorder, WavStreamPlayer
    clientRef.current = new RealtimeClient({ url: relayServerUrl });
    wavRecorderRef.current = new WavRecorder({ sampleRate: 24000 });
    wavStreamPlayerRef.current = new WavStreamPlayer({ sampleRate: 24000 });

    const client = clientRef.current;

    // Add these session settings
    client.updateSession({ 
      voice: 'alloy',
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: {
        type: 'server_vad'
      }
    });

    // Set up event handlers with error logging
    client.on('conversation.updated', async ({ item, delta }) => {
      console.log('Conversation updated:', { item, delta }); // Add logging
      if (delta?.audio) {
        setIsAITalking(true);
        await wavStreamPlayerRef.current.add16BitPCM(delta.audio, item.id);
        setIsAITalking(false);
      }

      // Update conversation items
      setConversationItems((prevItems) => {
        const existingItemIndex = prevItems.findIndex((i) => i.id === item.id);
        if (existingItemIndex !== -1) {
          const updatedItems = [...prevItems];
          updatedItems[existingItemIndex] = item;
          return updatedItems;
        } else {
          return [...prevItems, item];
        }
      });
    });

    // Add more detailed error logging
    client.on('error', (event) => {
      console.error('RealtimeClient error details:', event);
    });

    client.on('conversation.interrupted', async () => {
      // Fix: Use wavStreamPlayerRef.current
      const trackSampleOffset = await wavStreamPlayerRef.current.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });

    // Fix: Update cleanup to use refs
    return () => {
      client.disconnect();
      wavRecorderRef.current.end();
      wavStreamPlayerRef.current.interrupt();
    };
  }, []);

  const toggleCall = async () => {
    if (!isCallActive) {
      try {
        // Get audio stream when starting call
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioStream(stream);
        
        // Start the call
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        if (!client || !wavRecorder || !wavStreamPlayer) {
          throw new Error("Required resources not initialized");
        }

        // Connect to the relay server
        if (!client.isConnected()) {
          await client.connect();
        }

        // Start recording audio from the microphone with error handling
        try {
          await wavRecorder.begin();
          if (!isMuted && client.getTurnDetectionType() === 'server_vad') {
            await wavRecorder.record((data) => {
              client.appendInputAudio(data.mono);
            });
          }
        } catch (err) {
          console.error('Error starting audio recording:', err);
          return;
        }

        // Start the audio output with error handling
        try {
          await wavStreamPlayer.connect();
        } catch (err) {
          console.error('Error connecting audio output:', err);
          return;
        }

        // Only set call as active if everything succeeded
        setIsCallActive(true);

      } catch (err) {
        console.error('Error starting call:', err);
      }
    } else {
      try {
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        if (!client || !wavRecorder || !wavStreamPlayer) {
          throw new Error("Required resources not initialized");
        }

        // Only try to pause/end if we have an active processor
        try {
          if (!isMuted) {
            await wavRecorder.pause();
          }
          // Only call end() if we have an active session
          if (wavRecorder.processor) {
            await wavRecorder.end();
          }
        } catch (err) {
          console.error('Error stopping recorder:', err);
        }

        try {
          await wavStreamPlayer.interrupt();
        } catch (err) {
          console.error('Error stopping player:', err);
        }

        try {
          if (client.isConnected()) {
            client.disconnect();
          }
        } catch (err) {
          console.error('Error disconnecting client:', err);
        }

        // Set call as inactive after cleanup attempts
        setIsCallActive(false);
        
      } catch (err) {
        console.error('Error ending call:', err);
      }
      setAudioStream(null);
    }
  };

  const toggleMute = async () => {
    try {
      const wavRecorder = wavRecorderRef.current;
      if (!wavRecorder) return;

      if (isMuted) {
        // Unmuting
        await wavRecorder.record((data) => {
          clientRef.current?.appendInputAudio(data.mono);
        });
        setIsMuted(false);
      } else {
        // Muting
        await wavRecorder.pause();
        setIsMuted(true);
      }
    } catch (err) {
      console.error('Error toggling mute:', err);
      // Revert the mute state if there was an error
      setIsMuted((prev) => !prev);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto"
      >
        <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Training Call</h1>
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleMute}
                className="p-3 rounded-full bg-gray-100 hover:bg-gray-200"
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleCall}
                className={`p-3 rounded-full ${
                  isCallActive ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                }`}
              >
                {isCallActive ? <PhoneOff className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </motion.button>
            </div>
          </div>

          <AnimatePresence>
            {isCallActive && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
                  {conversationItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg mb-2 ${
                        item.role === 'user'
                          ? 'bg-blue-500 text-white ml-auto'
                          : 'bg-gray-200'
                      }`}
                    >
                      {item.formatted?.transcript || item.formatted?.text || ''}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      
      <VoiceVisualizer 
        isActive={isCallActive} 
        isAITalking={isAITalking}
        audioStream={audioStream}
      />
    </main>
  );
}