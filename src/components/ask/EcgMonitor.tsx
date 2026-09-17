import { useEffect, useRef } from "react";

const WIDTH = 1600;
const HEIGHT = 140;
const BASELINE = 75;
const SPEED_PX_PER_SEC = 150;
const POINT_SPACING = 2;

const TIER_COLORS: Record<number, string> = {
  1: "#059669", // self-care → green
  2: "#D97706", // specialist referral → amber
  3: "#DC2626", // emergency → red
};

// QRS-complex style waveform
function breathValueAt(distance: number): number {
  const period = 300;
  const t = distance % period;

  if (t < 30) return 0;
  if (t < 50) {
    const f = (t - 30) / 20;
    return 6 * Math.sin(f * Math.PI);
  }
  if (t < 60) {
    const f = (t - 50) / 10;
    return lerp(0, -8, f);
  }
  if (t < 68) {
    const f = (t - 60) / 8;
    return lerp(-8, 55, f);
  }
  if (t < 76) {
    const f = (t - 68) / 8;
    return lerp(55, -20, f);
  }
  if (t < 86) {
    const f = (t - 76) / 10;
    return lerp(-20, 0, f);
  }
  if (t < 110) return 0;
  if (t < 160) {
    const f = (t - 110) / 50;
    return 10 * Math.sin(f * Math.PI);
  }
  return 0;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

export function EcgMonitor({ tier = 1 }: { tier?: number }) {
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const distanceRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  const color = TIER_COLORS[tier] || TIER_COLORS[1];

  useEffect(() => {
    if (pointsRef.current.length === 0) {
      distanceRef.current = WIDTH;
      for (let x = 0; x <= WIDTH; x += POINT_SPACING) {
        pointsRef.current.push({ x, y: BASELINE + breathValueAt(x) });
      }
    }

    const step = (time: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      const dx = SPEED_PX_PER_SEC * dt;
      distanceRef.current += dx;

      const points = pointsRef.current;
      let x = points.length > 0 ? points[points.length - 1].x : 0;

      while (x < distanceRef.current) {
        x += POINT_SPACING;
        const y = BASELINE + breathValueAt(x);
        points.push({ x, y });
      }

      const minX = distanceRef.current - WIDTH;
      while (points.length > 0 && points[0].x < minX) {
        points.shift();
      }

      if (pathRef.current) {
        const d = points
          .map((p, i) => `${i === 0 ? "M" : "L"}${(p.x - distanceRef.current + WIDTH).toFixed(1)},${p.y.toFixed(1)}`)
          .join(" ");
        pathRef.current.setAttribute("d", d);
      }

      if (dotRef.current && points.length > 0) {
        const last = points[points.length - 1];
        dotRef.current.setAttribute("cx", (last.x - distanceRef.current + WIDTH).toFixed(1));
        dotRef.current.setAttribute("cy", last.y.toFixed(1));
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <svg
        className="absolute top-1/3 left-0 w-full opacity-[0.3] dark:opacity-[0.35]"
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="ecgGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path ref={pathRef} fill="none" stroke={color} strokeWidth="2" filter="url(#ecgGlow)" />
        <circle ref={dotRef} r="4" fill={color} filter="url(#ecgGlow)" />
      </svg>
    </div>
  );
}
