"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";

interface ChartProps {
  type: "bar" | "line" | "pie";
  data: { label: string; value: number; color?: string }[];
  title?: string;
  height?: number;
}

const PALETTE = [
  "#6366f1", // indigo-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#a855f7", // purple-500
  "#06b6d4", // cyan-500
  "#f43f5e", // rose-500
  "#84cc16", // lime-500
  "#ec4899", // pink-500
];

function getColor(index: number, custom?: string): string {
  return custom ?? PALETTE[index % PALETTE.length];
}

/* ------------------------------------------------------------------ */
/*  Tooltip                                                           */
/* ------------------------------------------------------------------ */

function Tooltip({ x, y, label, value }: { x: number; y: number; label: string; value: number }) {
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <rect
        x={x - 4}
        y={y - 32}
        width={Math.max(label.length, String(value).length) * 7 + 24}
        height={28}
        rx={6}
        fill="#18181b"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={1}
      />
      <text x={x + 8} y={y - 14} fill="#e4e4e7" fontSize={11} fontFamily="monospace">
        {label}: {value.toLocaleString()}
      </text>
    </motion.g>
  );
}

/* ------------------------------------------------------------------ */
/*  Bar Chart                                                         */
/* ------------------------------------------------------------------ */

function BarChartView({ data, chartHeight }: { data: ChartProps["data"]; chartHeight: number }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);
  const barHeight = Math.max(16, Math.min(32, (chartHeight - 24) / data.length - 4));
  const labelWidth = 100;
  const valueWidth = 60;
  const barAreaWidth = 400;

  const totalHeight = data.length * (barHeight + 4) + 8;

  return (
    <svg width="100%" viewBox={`0 0 ${labelWidth + barAreaWidth + valueWidth + 16} ${totalHeight}`} className="overflow-visible">
      {data.map((d, i) => {
        const y = i * (barHeight + 4) + 4;
        const width = (d.value / maxValue) * barAreaWidth;
        const color = getColor(i, d.color);

        return (
          <g
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-default"
          >
            <text
              x={labelWidth - 8}
              y={y + barHeight / 2 + 4}
              textAnchor="end"
              fill="#a1a1aa"
              fontSize={11}
            >
              {d.label.length > 14 ? d.label.slice(0, 13) + "\u2026" : d.label}
            </text>
            <motion.rect
              x={labelWidth}
              y={y}
              height={barHeight}
              rx={4}
              fill={color}
              opacity={hovered === null || hovered === i ? 0.85 : 0.4}
              initial={{ width: 0 }}
              animate={{ width }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
            />
            <text
              x={labelWidth + width + 8}
              y={y + barHeight / 2 + 4}
              fill="#d4d4d8"
              fontSize={11}
              fontFamily="monospace"
            >
              {d.value.toLocaleString()}
            </text>
            {hovered === i && (
              <Tooltip x={labelWidth + width + 4} y={y} label={d.label} value={d.value} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Line Chart                                                        */
/* ------------------------------------------------------------------ */

function LineChartView({ data, chartHeight }: { data: ChartProps["data"]; chartHeight: number }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const padX = 48;
  const padY = 24;
  const padBottom = 40;
  const width = 520;
  const plotH = chartHeight - padY - padBottom;
  const plotW = width - padX * 2;

  const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);

  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: padX + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW),
        y: padY + plotH - (d.value / maxValue) * plotH,
      })),
    [data, maxValue, plotW, plotH]
  );

  const polyline = points.map(p => `${p.x},${p.y}`).join(" ");

  // Grid lines
  const gridLines = 4;
  const gridSteps = Array.from({ length: gridLines + 1 }, (_, i) => i / gridLines);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${chartHeight}`} className="overflow-visible">
      {/* Grid */}
      {gridSteps.map((step, i) => {
        const y = padY + plotH - step * plotH;
        const val = Math.round(step * maxValue);
        return (
          <g key={i}>
            <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={padX - 8} y={y + 4} textAnchor="end" fill="#71717a" fontSize={10} fontFamily="monospace">
              {val.toLocaleString()}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <motion.polygon
        points={`${points[0]?.x ?? padX},${padY + plotH} ${polyline} ${points[points.length - 1]?.x ?? padX},${padY + plotH}`}
        fill="url(#lineGradient)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ duration: 0.6 }}
      />
      <defs>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Line */}
      <motion.polyline
        points={polyline}
        fill="none"
        stroke="#6366f1"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />

      {/* Dots and labels */}
      {points.map((p, i) => (
        <g
          key={i}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          className="cursor-default"
        >
          <circle cx={p.x} cy={p.y} r={hovered === i ? 6 : 4} fill="#6366f1" stroke="#18181b" strokeWidth={2} />
          {/* X-axis label */}
          <text
            x={p.x}
            y={padY + plotH + 16}
            textAnchor="middle"
            fill="#71717a"
            fontSize={10}
            transform={`rotate(-30, ${p.x}, ${padY + plotH + 16})`}
          >
            {data[i].label.length > 10 ? data[i].label.slice(0, 9) + "\u2026" : data[i].label}
          </text>
          {hovered === i && <Tooltip x={p.x} y={p.y} label={data[i].label} value={data[i].value} />}
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Pie Chart                                                         */
/* ------------------------------------------------------------------ */

function PieChartView({ data, chartHeight }: { data: ChartProps["data"]; chartHeight: number }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);
  const cx = 120;
  const cy = chartHeight / 2;
  const r = Math.min(cx - 8, cy - 8);

  const slices = useMemo(() => {
    let cumulative = 0;
    return data.map((d, i) => {
      const start = cumulative;
      const angle = total === 0 ? 0 : (d.value / total) * Math.PI * 2;
      cumulative += angle;
      return { ...d, startAngle: start, endAngle: start + angle, color: getColor(i, d.color) };
    });
  }, [data, total]);

  function arcPath(startAngle: number, endAngle: number, radius: number): string {
    const start = {
      x: cx + Math.cos(startAngle - Math.PI / 2) * radius,
      y: cy + Math.sin(startAngle - Math.PI / 2) * radius,
    };
    const end = {
      x: cx + Math.cos(endAngle - Math.PI / 2) * radius,
      y: cy + Math.sin(endAngle - Math.PI / 2) * radius,
    };
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
  }

  const legendX = cx * 2 + 24;

  return (
    <svg width="100%" viewBox={`0 0 ${legendX + 180} ${chartHeight}`} className="overflow-visible">
      {slices.map((s, i) => {
        const midAngle = (s.startAngle + s.endAngle) / 2 - Math.PI / 2;
        const tooltipX = cx + Math.cos(midAngle) * (r * 0.6);
        const tooltipY = cy + Math.sin(midAngle) * (r * 0.6);

        return (
          <motion.path
            key={i}
            d={arcPath(s.startAngle, s.endAngle, hovered === i ? r + 4 : r)}
            fill={s.color}
            opacity={hovered === null || hovered === i ? 0.85 : 0.45}
            stroke="#09090b"
            strokeWidth={2}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-default"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: hovered === null || hovered === i ? 0.85 : 0.45 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            {hovered === i && (
              <title>{`${s.label}: ${s.value.toLocaleString()} (${total > 0 ? ((s.value / total) * 100).toFixed(1) : 0}%)`}</title>
            )}
          </motion.path>
        );
      })}

      {/* Hover tooltip via SVG title is above; also show a text */}
      {hovered !== null && (
        <Tooltip
          x={cx + r + 12}
          y={cy - 8}
          label={slices[hovered].label}
          value={slices[hovered].value}
        />
      )}

      {/* Legend */}
      {slices.map((s, i) => {
        const ly = 16 + i * 20;
        const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : "0";
        return (
          <g
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-default"
          >
            <rect x={legendX} y={ly - 5} width={10} height={10} rx={2} fill={s.color} />
            <text x={legendX + 16} y={ly + 4} fill="#d4d4d8" fontSize={11}>
              {s.label.length > 16 ? s.label.slice(0, 15) + "\u2026" : s.label}
            </text>
            <text x={legendX + 150} y={ly + 4} fill="#71717a" fontSize={10} textAnchor="end" fontFamily="monospace">
              {pct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Chart Component                                              */
/* ------------------------------------------------------------------ */

export default function Chart({ type, data, title, height = 240 }: ChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-zinc-900 p-6 text-center text-zinc-400">
        No chart data.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg border border-white/[0.06] bg-zinc-900 overflow-hidden"
    >
      {title && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <BarChart3 className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-medium text-zinc-200">{title}</span>
        </div>
      )}
      <div className="p-4">
        {type === "bar" && <BarChartView data={data} chartHeight={height} />}
        {type === "line" && <LineChartView data={data} chartHeight={height} />}
        {type === "pie" && <PieChartView data={data} chartHeight={height} />}
      </div>
    </motion.div>
  );
}
