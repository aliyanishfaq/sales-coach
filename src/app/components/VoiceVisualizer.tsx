'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';

interface VoiceVisualizerProps {
  isActive: boolean;
  isAITalking: boolean;
  audioStream?: MediaStream | null;
}

export function VoiceVisualizer({ isActive, isAITalking, audioStream }: VoiceVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const noise3D = createNoise3D();

  useEffect(() => {
    if (!containerRef.current) return;

    // Audio setup
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    
    if (audioStream) {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(audioStream);
      source.connect(analyser);
      
      // Smaller FFT size for more responsive analysis
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
    }

    // Three.js setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 50);

    const renderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: true 
    });
    renderer.setSize(300, 300);
    containerRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(8, 16, 16);
    const positions = new Float32Array(geometry.attributes.position.array);
    const originalPositions = positions.slice();
    
    const material = new THREE.MeshLambertMaterial({
      color: isAITalking ? 0xff7f50 : 0xff8c44,
      wireframe: true,
      wireframeLinewidth: 0.8,
    });
    
    const sphere = new THREE.Mesh(geometry, material);

    const ambientLight = new THREE.AmbientLight(0xfff0e6);
    const spotLight = new THREE.SpotLight(0xffd700);
    spotLight.position.set(-10, 40, 20);
    spotLight.intensity = 0.8;
    spotLight.lookAt(sphere);

    scene.add(sphere);
    scene.add(ambientLight);
    scene.add(spotLight);
    sceneRef.current = scene;

    function getAudioLevel(): number {
      if (!analyser) return 0;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // Get meaningful frequency range (exclude very low frequencies)
      const meaningfulRange = dataArray.slice(2, dataArray.length - 1);
      const sum = meaningfulRange.reduce((acc, val) => acc + val, 0);
      const avg = sum / meaningfulRange.length;
      
      // Normalize and apply threshold
      const threshold = 15;
      const normalized = Math.max(0, avg - threshold) / (255 - threshold);
      
      // More aggressive scaling for voice
      return Math.pow(normalized, 1.2) * 1.5;
    }

    let lastLevel = 0;
    const smoothingFactor = 0.3; // Adjust for smoother/faster transitions

    function animate() {
      if (!isActive) return;

      sphere.rotation.y += 0.003;
      
      // Smooth the audio level transitions
      const currentLevel = getAudioLevel();
      lastLevel = lastLevel + (currentLevel - lastLevel) * smoothingFactor;
      
      // More dramatic scaling
      const minRadius = 8;
      const maxRadius = 25;
      const baseRadius = minRadius + (lastLevel * (maxRadius - minRadius));
      
      const minAmplitude = 2;
      const maxAmplitude = 8;
      const amplitude = minAmplitude + (lastLevel * (maxAmplitude - minAmplitude));

      const positions = geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        const vertex = new THREE.Vector3(
          originalPositions[i],
          originalPositions[i + 1],
          originalPositions[i + 2]
        ).normalize();

        const time = Date.now() * 0.0003;
        const theta = Math.atan2(vertex.y, vertex.x);
        const phi = Math.atan2(Math.sqrt(vertex.x * vertex.x + vertex.y * vertex.y), vertex.z);
        
        const distortion = noise3D(
          Math.sin(theta + time) * 2,
          Math.cos(phi + time) * 2,
          time
        );

        const distance = baseRadius + (distortion * amplitude);
        vertex.multiplyScalar(distance);

        positions[i] = vertex.x;
        positions[i + 1] = vertex.y;
        positions[i + 2] = vertex.z;
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    animate();

    return () => {
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      if (audioContext) {
        audioContext.close();
      }
      geometry.dispose();
      material.dispose();
    };
  }, [isActive, isAITalking, audioStream]);

  return (
    <div 
      ref={containerRef} 
      className="fixed bottom-8 right-8 w-[300px] h-[300px]"
    />
  );
}