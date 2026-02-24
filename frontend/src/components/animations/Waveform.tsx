"use client";

import { motion } from "framer-motion";

interface WaveformProps {
  isActive?: boolean;
  barCount?: number;
  className?: string;
}

export default function Waveform({
  isActive = true,
  barCount = 4,
  className = "",
}: WaveformProps) {
  return (
    <div className={`flex items-center justify-center gap-0.5 h-4 ${className}`}>
      {Array.from({ length: barCount }).map((_, index) => (
        <motion.div
          key={index}
          className="w-0.5 rounded-full bg-indigo-400"
          animate={isActive ? {
            height: ["30%", "100%", "30%"],
            opacity: [0.5, 1, 0.5],
          } : {
            height: "30%",
            opacity: 0.3,
          }}
          transition={{
            duration: 0.8,
            repeat: isActive ? Infinity : 0,
            delay: index * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Simple status dot
interface BreathingRingProps {
  isActive?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function BreathingRing({
  isActive = true,
  size = "md",
  className = "",
}: BreathingRingProps) {
  const sizeMap = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-3 h-3",
  };

  return (
    <div className={`relative ${className}`}>
      <motion.div
        className={`${sizeMap[size]} rounded-full bg-emerald-500`}
        animate={isActive ? {
          opacity: [1, 0.5, 1],
        } : {
          opacity: 0.5,
        }}
        transition={{
          duration: 2,
          repeat: isActive ? Infinity : 0,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

// Pulse dots for typing indicator
interface PulseDotsProps {
  className?: string;
}

export function PulseDots({ className = "" }: PulseDotsProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className="w-1.5 h-1.5 rounded-full bg-indigo-400"
          animate={{
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: index * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Simple border wrapper
interface GradientBorderProps {
  children: React.ReactNode;
  className?: string;
}

export function GradientBorder({ children, className = "" }: GradientBorderProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -inset-[1px] rounded-xl z-[-1] bg-gradient-to-r from-indigo-500/30 to-violet-500/30" />
      <div className="relative bg-[#09090b] rounded-xl overflow-hidden h-full">
        {children}
      </div>
    </div>
  );
}
