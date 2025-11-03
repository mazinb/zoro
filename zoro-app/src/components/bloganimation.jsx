import { useEffect, useMemo, useRef, useState } from "react";

/**
 * ZoroLearningAnimation
 * A small, looped SVG animation that simulates reacting to articles.
 * Steps:
 * 1) Agree highlight pulses
 * 2) Disagree highlight appears with sample comments
 * 3) "Zoro is learning" indicator glows
 * 4) Brief pause, then loop
 */
export default function ZoroLearningAnimation({ width = 320, height = 280, darkMode = false }) {
  const [step, setStep] = useState(0);
  const timeoutsRef = useRef([]);

  // Colors based on theme
  const colors = useMemo(() => {
    // Invert palette: use dark-mode visuals in light mode and vice versa
    const inverted = !darkMode;
    return {
      bg: inverted ? "#0B1220" : "#FFFFFF",
      border: inverted ? "#1F2937" : "#E5E7EB",
      textPrimary: inverted ? "#E5E7EB" : "#111827",
      textSecondary: inverted ? "#9CA3AF" : "#4B5563",
      neutralLine: inverted ? "#E5E7EB" : "#111827",
      agree: "#10B981",
      disagree: "#EF4444",
      learn: "#22D3EE",
      rowBg: inverted ? "#111827" : "#F9FAFB",
    };
  }, [darkMode]);

  // Looped sequence controller
  useEffect(() => {
    let isMounted = true;

    const clearAll = () => {
      timeoutsRef.current.forEach((id) => clearTimeout(id));
      timeoutsRef.current = [];
    };

    const delay = (ms) =>
      new Promise((resolve) => {
        const id = setTimeout(resolve, ms);
        timeoutsRef.current.push(id);
      });

    async function run() {
      while (isMounted) {
        setStep(0); // Base doc
        await delay(700);
        setStep(1); // Green highlight + Agree
        await delay(900);
        setStep(2); // Bubble: Love this hack
        await delay(900);
        setStep(3); // Two red highlights + Disagree
        await delay(900);
        setStep(4); // Bubble: This is too risky!
        await delay(900);
        setStep(5); // Learning pulse + text
        await delay(1200);
      }
    }

    run();
    return () => {
      isMounted = false;
      clearAll();
    };
  }, []);

  return (
    <svg
      width="100%"
      height="auto"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif", maxWidth: `${width}px`, display: 'block' }}
    >
      {/* Card background */}
      <rect x="0" y="0" width={width} height={height} rx="12" fill={colors.bg} />
      <rect x="0.5" y="0.5" width={width - 1} height={height - 1} rx="12" fill="none" stroke={colors.border} />

      {/* Top spacing (kept), first line below will visually serve as the header line */}

      {/* Nine left-aligned lines with contrast */}
      {(() => {
        const padding = 16;
        const startY = 40;
        const lineH = 8;
        const gap = 16;
        const contentW = width - padding * 2;
        // First 6 lines only; line 2 (index 1) shortened to avoid Agree pill overlap
        const widths = [0.9, 0.62, 0.72, 0.92, 0.62, 0.88];
        const nodes = [];

        // Draw 9 slots worth of vertical space but only render 6 lines
        for (let i = 0; i < 9; i++) {
          const y = startY + i * (lineH + gap);
          if (i < 6) {
            const w = contentW * widths[i];
            nodes.push(
              <rect key={`ln-${i}`} x={padding} y={y} width={w} height={lineH} rx={lineH / 2}
                fill={colors.neutralLine} opacity={0.22} />
            );
          }
        }

        // Step 1: green highlight on line 2 (index 1) + Agree pill
        if (step >= 1) {
          const idx = 1;
          const y = startY + idx * (lineH + gap) - 2;
          const w = contentW * widths[idx];
          nodes.push(
            <rect key="hl-green" x={padding} y={y} width={w} height={lineH + 6} rx={6} fill={colors.agree} opacity={0.22} />
          );
          const pillWidth = 86;
          const pillX = width - padding - pillWidth; // Right-aligned
          nodes.push(
            <rect key="pill-agree" x={pillX} y={y - 2} width={pillWidth} height={22} rx={11} fill={colors.agree} />
          );
          nodes.push(
            <text key="txt-agree" x={pillX + pillWidth / 2} y={y + 13} fill="#FFFFFF" fontSize="12" fontWeight="700" textAnchor="middle">Agree</text>
          );
        }

        // Step 3: red highlights on lines 4 and 5 (indices 3 and 4) + Disagree on line 5
        if (step >= 3) {
          const idx4 = 3;
          const idx5 = 4;
          const y4 = startY + idx4 * (lineH + gap) - 2;
          const y5 = startY + idx5 * (lineH + gap) - 2;
          const w4 = contentW * widths[idx4];
          const w5 = contentW * widths[idx5];
          nodes.push(
            <rect key="hl-red-1" x={padding} y={y4} width={w4} height={lineH + 6} rx={6} fill={colors.disagree} opacity={0.2} />
          );
          nodes.push(
            <rect key="hl-red-2" x={padding} y={y5} width={w5} height={lineH + 6} rx={6} fill={colors.disagree} opacity={0.2} />
          );
          const pillWidth = 108;
          const pillX = width - padding - pillWidth; // Right-aligned
          nodes.push(
            <rect key="pill-dis" x={pillX} y={y5 - 2} width={pillWidth} height={22} rx={11} fill={colors.disagree} />
          );
          nodes.push(
            <text key="txt-dis" x={pillX + pillWidth / 2} y={y5 + 13} fill="#FFFFFF" fontSize="12" fontWeight="700" textAnchor="middle">Disagree</text>
          );
        }

        return nodes;
      })()}

      {/* Bottom-right chat bubbles (sequential) */}
      {step >= 2 && (
        <>
          {(() => {
            const padding = 16;
            const bw = 158, bh = 28;
            const x = width - padding - bw;
            const y = height - 88;
            return (
              <>
                <rect x={x} y={y} width={bw} height={bh} rx={13} fill={colors.rowBg} />
                <text x={x + 12} y={y + 18} fill={colors.textPrimary} fontSize="12">Love this hack</text>
              </>
            );
          })()}

          {step >= 4 && (() => {
            const padding = 16;
            const bw = 176, bh = 28;
            const x = width - padding - bw;
            const y = height - 52; // below the first bubble
            return (
              <>
                <rect x={x} y={y} width={bw} height={bh} rx={13} fill={colors.rowBg} />
                <text x={x + 12} y={y + 18} fill={colors.textPrimary} fontSize="12">This is too risky!</text>
              </>
            );
          })()}
        </>
      )}

      {/* Learning indicator */}
      {step >= 5 && (
        <>
          <circle cx="28" cy={height - 24} r="6" fill={colors.learn}>
            <animate attributeName="r" values="6;8;6" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.5;1" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <text x="44" y={height - 20} fill={colors.textSecondary} fontSize="12">Zoro learns</text>
        </>
      )}
    </svg>
  );
}
