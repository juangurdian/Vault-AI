"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Sparkles, Check } from "lucide-react";
import { GlowButton } from "@/components/animations";

type FeedbackProps = {
  messageId: string;
  onSubmit: (rating: number) => void;
};

export default function Feedback({ messageId, onSubmit }: FeedbackProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmit(rating);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <motion.div
        className="flex items-center gap-2 text-xs text-emerald-400"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Check className="h-3.5 w-3.5" />
        <span>Thanks for your feedback!</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <span className="text-xs text-slate-500">Rate response:</span>

      {/* Star rating */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            className="p-1 transition-colors"
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
          >
            <Star
              className={`h-4 w-4 transition-all duration-200 ${
                (hoveredRating > 0 ? star <= hoveredRating : star <= rating)
                  ? "text-amber-400 fill-amber-400"
                  : "text-slate-600"
              }`}
            />
          </motion.button>
        ))}
      </div>

      {/* Submit button */}
      <AnimatePresence>
        {rating > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <GlowButton
              onClick={handleSubmit}
              variant="secondary"
              size="sm"
              className="px-2 py-1 text-[10px]"
            >
              <Sparkles className="h-3 w-3" />
              Submit
            </GlowButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
