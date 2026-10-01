import { motion, useScroll, useTransform } from "framer-motion";

/**
 * Landing-page backdrop: a faint orange plus-sign lattice over the whole page,
 * plus one soft warm halo behind the hero. Fixed, non-interactive, and
 * deliberately quiet - texture, not decoration.
 *
 * Why the lattice never visibly "ends" while scrolling:
 *  - The sheet is a 300vh-tall tiled field starting 100vh above the viewport,
 *    so it always overhangs the screen on both sides.
 *  - It slides at most 80vh as the page scrolls, so its top edge can never
 *    rise above -20vh and its bottom edge never enters the viewport.
 *  - The radial fade lives on a STATIC wrapper (viewport space), so the
 *    vignette stays put while the texture drifts underneath it.
 */
export function LandingBackground() {
  const { scrollYProgress } = useScroll();
  const latticeY = useTransform(scrollYProgress, [0, 1], ["0vh", "80vh"]);
  const haloY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Viewport-anchored vignette; the lattice drifts beneath it */}
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_85%_70%_at_50%_50%,black_35%,transparent_78%)]">
        <motion.div
          style={{ y: latticeY }}
          className="absolute inset-x-0 -top-[100vh] h-[300vh] lattice-fade"
        />
      </div>

      {/* Single warm halo behind the hero copy; drifts slightly slower */}
      <motion.div
        style={{ y: haloY }}
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[520px] rounded-full opacity-[0.07] dark:opacity-[0.09] blur-3xl"
      >
        <div
          className="w-full h-full rounded-full"
          style={{ background: "radial-gradient(circle, #EA580C, transparent 70%)" }}
        />
      </motion.div>
    </div>
  );
}
