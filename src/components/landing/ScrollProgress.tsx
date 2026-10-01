import { motion, useScroll, useSpring } from "framer-motion";

/**
 * 2px orange progress bar fixed to the top of the viewport, filling as the
 * page scrolls. Spring-smoothed so it glides instead of snapping.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.4,
  });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 h-[3px] bg-[#EA580C] origin-left z-50"
    />
  );
}
