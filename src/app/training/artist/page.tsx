'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, ArrowLeft } from 'lucide-react';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { WavRecorder, WavStreamPlayer } from '@/app/lib/wavtools';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamic import of Scene component
const Scene = dynamic(() => import('@/app/components/Scene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="animate-pulse text-violet-400">Loading...</div>
    </div>
  )
});

export default function TrainingSession() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [conversationItems, setConversationItems] = useState<ItemType[]>([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string>('');
  const [lastAIResponse, setLastAIResponse] = useState<string>('');

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
      voice: 'shimmer',
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: {
        type: 'server_vad'
      },
      //threshold: 0.65,
      instructions: `
      You are Katie, a pragmatic, cautious owner of a moderately upscale restaurant on University Avenue in Palo Alto. Your clientele—university students, tech professionals, and local families—value your high-quality food and welcoming atmosphere. Over the last 12 years, you’ve built a steady business based on reliability and trust within the community. Any new partnership must preserve what you’ve worked hard to build.

      You’ve been pitched by food delivery services before and remain skeptical about their value. Your concerns are practical: poor delivery execution might damage your brand, upset loyal customers, or complicate operations. You’re open to hearing about DoorDash but need convincing, actionable details—not fluff or pushy tactics.

      Mindset:
      1. Risk-Averse: Change must align with your focus on stability, not disrupt your carefully maintained reputation or margins.
      2. Customer-First: Delivery must enhance customer experience without sacrificing food quality, speed, or service.
      3. Battle-Tested Skepticism: Past pitches from Uber Eats and Grubhub left you unconvinced. You’re wary of generic promises like “boosted sales” and need specifics tailored to your business.

      How You Engage:
      1. Polite but No-Nonsense: You listen calmly but won’t tolerate vague or repetitive pitches. Conversations must be concise and relevant, or you’ll cut them short.
      2. Ask Tough Questions: You challenge claims with pointed questions:
      “How do you ensure my food arrives fresh and meets my quality standards?”
      “How will this increase sales without cannibalizing in-house dining?”
      “What happens if a delivery error upsets one of my regulars?”
      3. Pressure is a Red Flag: Pushiness makes you firm:
      “I need more specifics, not promises. Let’s stop if you can’t address my concerns.”
      “I’ve said I’m not ready for a big change—please respect that.”
      4. Shorter Answers: As you lose patience, responses become curt: “Yes, but how does that actually help my customers?”
      
      Do NOT be verbose. Your responses must be concise and natural, avoiding any robotic or ChatGPT-like tone. Stay fully in character as Katie, speaking conversationally and pragmatically. Stick to relevant topics—do not go off track with irrelevant questions, like asking about packaging materials in a previous roleplay. Focus on what matters to Katie: the impact on her business, operations, and customers. Do not be so conservative that you keep questioning every detail. Be realistic. 

      `
    });

    // Set up event handlers with error logging
    client.on('conversation.updated', async ({ item, delta }: { item: ItemType, delta: any }) => {
      console.log('Conversation Update Received:', { 
        role: item.role,
        content: item.formatted?.transcript || item.formatted?.text,
        delta 
      });

      // Track messages based on role
      if (item.role === 'user') {
        const message = item.formatted?.transcript || '';
        setLastUserMessage(message);
        console.log('User said:', message);
      } else if (item.role === 'assistant') {
        const message = item.formatted?.text || '';
        setLastAIResponse(message);
        console.log('AI responded:', message);
      }

      if (delta?.audio && wavStreamPlayerRef.current) {
        try {
          console.log('Playing audio response...');
          await wavStreamPlayerRef.current.add16BitPCM(delta.audio, item.id);
        } catch (err) {
          console.error('Error playing audio:', err);
        }
      }

      // Update conversation items
      setConversationItems((prevItems) => {
        const existingItemIndex = prevItems.findIndex((i) => i.id === item.id);
        if (existingItemIndex !== -1) {
          const updatedItems = [...prevItems];
          updatedItems[existingItemIndex] = item;
          console.log('Updated conversation history:', updatedItems);
          return updatedItems;
        } else {
          const newItems = [...prevItems, item];
          console.log('Updated conversation history:', newItems);
          return newItems;
        }
      });
    });

    // Add more detailed error logging
    client.on('error', (event: Error) => {
      console.error('RealtimeClient error details:', event);
    });

    client.on('conversation.interrupted', async () => {
      if (!wavStreamPlayerRef.current) return;
      
      const trackSampleOffset = await wavStreamPlayerRef.current.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });

    return () => {
      const cleanup = async () => {
        try {
          if (sessionActive && wavRecorderRef.current) {
            await wavRecorderRef.current.end();
            setSessionActive(false);
          }
          
          if (wavStreamPlayerRef.current) {
            await wavStreamPlayerRef.current.interrupt();
          }
          
          if (clientRef.current?.isConnected()) {
            await clientRef.current.disconnect();
          }
        } catch (err) {
          console.error('Error during cleanup:', err);
        }
      };
      
      cleanup();
    };
  }, []);

  const toggleCall = async () => {
    if (!isCallActive) {
      console.log('Starting call...');
      try {
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        if (!client || !wavRecorder || !wavStreamPlayer) {
          throw new Error("Required resources not initialized");
        }

        // Clean up any existing sessions first
        if (sessionActive) {
          await wavRecorder.end();
          setSessionActive(false);
        }
        
        await wavStreamPlayer.interrupt();
        if (client.isConnected()) {
          await client.disconnect();
        }

        // Start new session
        await client.connect();
        await wavStreamPlayer.connect();
        
        // Initialize recording
        await wavRecorder.begin();
        setSessionActive(true);

        // Start recording if not muted
        if (!isMuted) {
          await wavRecorder.record((data) => {
            if (client.isConnected()) {
              client.appendInputAudio(data.mono);
              console.log('Sending audio data to server...');
            }
          });
        }

        setIsCallActive(true);
        console.log('Connected to relay server');
        console.log('Recording session started');

      } catch (err) {
        console.error('Error starting call:', err);
        // Cleanup on error
        try {
          const wavRecorder = wavRecorderRef.current;
          if (wavRecorder && sessionActive) {
            await wavRecorder.end();
            setSessionActive(false);
          }
        } catch (cleanupErr) {
          console.error('Error during cleanup:', cleanupErr);
        }
      }
    } else {
      console.log('Ending call...');
      try {
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        // Stop recording first
        if (wavRecorder && sessionActive) {
          if (!isMuted) {
            await wavRecorder.pause();
          }
          await wavRecorder.end();
          setSessionActive(false);
        }

        // Then stop playback
        if (wavStreamPlayer) {
          await wavStreamPlayer.interrupt();
        }

        // Finally disconnect client
        if (client?.isConnected()) {
          await client.disconnect();
        }

        setIsCallActive(false);
        console.log('Call successfully ended');
      } catch (err) {
        console.error('Error ending call:', err);
      }
    }
  };

  const toggleMute = async () => {
    try {
      const wavRecorder = wavRecorderRef.current;
      if (!wavRecorder || !sessionActive) {
        console.log('Cannot toggle mute: no active session');
        return;
      }

      if (isMuted) {
        console.log('Unmuting microphone...');
        // Unmuting
        await wavRecorder.begin();
        await wavRecorder.record((data) => {
          if (clientRef.current?.isConnected()) {
            clientRef.current.appendInputAudio(data.mono);
          }
        });
        setIsMuted(false);
        console.log('Microphone unmuted');
      } else {
        console.log('Muting microphone...');
        // Muting
        await wavRecorder.pause();
        setIsMuted(true);
        console.log('Microphone muted');
      }
    } catch (err) {
      console.error('Error toggling mute:', err);
      setIsMuted((prev) => !prev);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden font-sans relative">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-zinc-50/90 to-zinc-100/80" />
      <div className="absolute inset-0">
        <div className="absolute top-0 -right-1/4 w-1/2 h-1/2 bg-gradient-to-br from-violet-100/20 via-blue-100/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-tr from-amber-100/20 via-purple-100/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative min-h-screen flex flex-col lg:flex-row">
        {/* Left side - Chat Interface */}
        <div className="w-full lg:w-[45%] p-6 md:p-12 lg:p-16 flex flex-col">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link href="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-violet-500 mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to personas
            </Link>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-3 h-3 rounded-full bg-violet-400"
                />
                <h1 className="font-serif text-3xl md:text-4xl text-zinc-900">
                  Artist Training
                </h1>
              </div>
              
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleMute}
                  className="p-2.5 rounded-xl bg-white/50 hover:bg-white/80 border border-zinc-200 shadow-sm"
                >
                  {isMuted ? <MicOff className="w-5 h-5 text-zinc-600" /> : <Mic className="w-5 h-5 text-violet-500" />}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleCall}
                  className={`p-2.5 rounded-xl shadow-sm border ${
                    isCallActive 
                      ? 'bg-red-50 border-red-200 hover:bg-red-100' 
                      : 'bg-violet-50 border-violet-200 hover:bg-violet-100'
                  }`}
                >
                  {isCallActive ? 
                    <PhoneOff className="w-5 h-5 text-red-500" /> : 
                    <Phone className="w-5 h-5 text-violet-500" />
                  }
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Chat Interface */}
          <AnimatePresence>
            {isCallActive && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 bg-white/50 backdrop-blur-sm rounded-2xl border border-zinc-200 shadow-sm overflow-hidden"
              >
                <div className="h-full flex flex-col p-4">
                  <div className="flex-1 overflow-y-auto space-y-4 p-2">
                    {conversationItems.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`max-w-[80%] ${
                          item.role === 'user' ? 'ml-auto' : 'mr-auto'
                        }`}
                      >
                        <div className={`p-3 rounded-2xl ${
                          item.role === 'user'
                            ? 'bg-gradient-to-r from-violet-500 to-violet-600 text-white'
                            : 'bg-gradient-to-r from-zinc-100 to-zinc-200 text-zinc-800'
                        }`}>
                          {item.formatted?.transcript || item.formatted?.text || ''}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right side - Blob Visualization */}
        <div className="w-full lg:w-[55%] h-[400px] md:h-[500px] lg:h-auto relative flex items-center justify-center">
          <div className="absolute inset-[-50px] flex items-center justify-center">
            <div className="transform-gpu">
              <div className="p-16 md:p-24 lg:p-32">
                <div className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] lg:w-[600px] lg:h-[600px] relative">
                  <Suspense fallback={
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="animate-pulse text-violet-400">Loading...</div>
                    </div>
                  }>
                    <Scene 
                      isActive={isCallActive}
                      color="#8B5CF6" // Violet color for artist persona
                    />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
