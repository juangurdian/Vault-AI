"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface GlowButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  glowColor?: string;
  className?: string;
}

const variantStyles = {
  primary: "bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold",
  secondary: "glass bg-white/5 text-slate-200 font-medium",
  ghost: "bg-transparent text-slate-400 hover:text-slate-200",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export default function GlowButton({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  size = "md",
  glowColor = "rgba(34, 211, 238, 0.5)",
  className = "",
}: GlowButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative overflow-hidden rounded-xl
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      whileHover={disabled ? undefined : {
        scale: 1.02,
        boxShadow: `0 0 30px ${glowColor}, 0 0 60px ${glowColor}`,
      }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
    >
      {/* Hover gradient overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        initial={{ x: "-100%", opacity: 0 }}
        whileHover={{ x: "100%", opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
}
