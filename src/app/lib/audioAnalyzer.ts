export class AudioAnalyzer {
    private analyser: AnalyserNode;
    private dataArray: Uint8Array;
    private audioContext: AudioContext;
    private source: MediaStreamAudioSourceNode | null = null;
  
    constructor() {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      
      // Adjust these values for better visualization
      this.analyser.fftSize = 32; // Smaller FFT for faster updates
      this.analyser.smoothingTimeConstant = 0.6; // Smoother transitions
      
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
  
    connectToStream(stream: MediaStream | null) {
      try {
        if (!stream) return;

        // Cleanup previous source
        if (this.source) {
          this.source.disconnect();
          this.source = null;
        }

        // Create and connect new source
        this.source = this.audioContext.createMediaStreamSource(stream);
        this.source.connect(this.analyser);
        
        console.log('Successfully connected to audio stream');
      } catch (error) {
        console.error('Error connecting to audio stream:', error);
      }
    }
  
    getAverageVolume(): number {
      if (!this.source) return 0.3;

      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Calculate average volume
      const sum = this.dataArray.reduce((acc, val) => acc + val, 0);
      const average = sum / this.dataArray.length;
      
      // Normalize and apply some exponential scaling for better visual effect
      const normalized = Math.min(1, Math.pow(average / 128, 1.5));
      
      // Log the volume for debugging
      if (normalized > 0.4) {
        console.log('Current volume:', normalized);
      }
      
      return normalized;
    }

    cleanup() {
      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }
    }
  }