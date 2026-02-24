"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface TextRevealProps {
  children: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
  once?: boolean;
}

export default function TextReveal({
  children,
  className = "",
  delay = 0,
  staggerDelay = 0.02,
  once = true,
}: TextRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once, amount: 0.5 });

  const words = children.split(" ");

  return (
    <span ref={ref} className={className}>
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block mr-[0.25em]">
          {word.split("").map((char, charIndex) => (
            <motion.span
              key={charIndex}
              className="inline-block"
              initial={{ opacity: 0, y: 8 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{
                duration: 0.2,
                delay: delay + (wordIndex * word.length + charIndex) * staggerDelay,
                ease: [0.25, 0.1, 0.25, 1],
              }}
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </span>
  );
}

// Simple fade-in text for streaming messages
interface StreamingTextProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

export function StreamingText({
  content,
  className = "",
  isStreaming = false,
}: StreamingTextProps) {
  return (
    <span className={className}>
      {content}
      {isStreaming && (
        <span className="inline-block w-2 h-5 ml-0.5 bg-indigo-400 align-middle animate-pulse" />
      )}
    </span>
  );
}

// Word-by-word reveal for large text
interface WordRevealProps {
  children: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
}

export function WordReveal({
  children,
  className = "",
  delay = 0,
  staggerDelay = 0.08,
}: WordRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const words = children.split(" ");

  return (
    <div ref={ref} className={className}>
      {words.map((word, index) => (
        <motion.span
          key={index}
          className="inline-block mr-[0.3em]"
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.3,
            delay: delay + index * staggerDelay,
            ease: [0.25, 0.4, 0.25, 1],
          }}
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
}
