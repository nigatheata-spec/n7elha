import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface HandWrittenTitleProps {
  text: string;
  className?: string;
}

export const HandWrittenTitle = ({ text, className }: HandWrittenTitleProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.045, delayChildren: 0.1 },
    },
  };

  const letter = {
    hidden: { opacity: 0, y: 18, rotate: -4, scale: 0.85 },
    visible: {
      opacity: 1,
      y: 0,
      rotate: 0,
      scale: 1,
      transition: { type: "spring", stiffness: 180, damping: 16 },
    },
  };

  const chars = Array.from(text);

  return (
    <motion.span
      ref={ref}
      className={className}
      variants={container}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "baseline" }}
    >
      {chars.map((ch, i) =>
        ch === " " ? (
          <span key={i} style={{ width: "0.3em", display: "inline-block" }} />
        ) : (
          <motion.span key={i} variants={letter} style={{ display: "inline-block" }}>
            {ch}
          </motion.span>
        )
      )}
    </motion.span>
  );
};
