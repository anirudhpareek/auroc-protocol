"use client";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  marks?: number[];
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  marks = [0, 25, 50, 75, 100],
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2.5">
      <div className="relative h-4 flex items-center">
        {/* Track */}
        <div className="absolute w-full h-[3px] rounded-full overflow-hidden" style={{ background: "var(--bg-overlay)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(to right, rgba(245,166,35,0.3), var(--accent))",
            }}
          />
        </div>

        {/* Native range for interaction */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer"
          style={{ height: "16px", zIndex: 2 }}
        />

        {/* Thumb */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `calc(${pct}% - 7px)`,
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: "var(--text-primary)",
            boxShadow: "0 0 0 2px var(--bg-base), 0 0 10px var(--accent-glow)",
            zIndex: 1,
          }}
        />
      </div>

      {/* Mark labels */}
      <div className="flex justify-between">
        {marks.map((mark) => (
          <button
            key={mark}
            onClick={() => onChange(mark)}
            className="text-[10px] font-semibold transition-colors"
            style={{ color: value >= mark ? "var(--accent)" : "var(--text-muted)" }}
          >
            {mark}
          </button>
        ))}
      </div>
    </div>
  );
}
