import { useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AeroMode } from '../three/f1Chassis2026Spec';
import {
  TelemetrySample,
  createInitialTelemetryHistory,
  getAeroCoefficients,
  stepTelemetrySample,
} from '../three/f1Telemetry';

interface TelemetryOverlayProps {
  aeroMode: AeroMode;
  speedKmh: number;
}

const HISTORY_LENGTH = 28;
const SAMPLE_INTERVAL_MS = 220;

export function TelemetryOverlay({ aeroMode, speedKmh }: TelemetryOverlayProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [samples, setSamples] = useState<TelemetrySample[]>(() =>
    createInitialTelemetryHistory(speedKmh, aeroMode, HISTORY_LENGTH),
  );

  const liveInputsRef = useRef({ aeroMode, speedKmh });
  liveInputsRef.current = { aeroMode, speedKmh };
  const tickRef = useRef(HISTORY_LENGTH);

  useEffect(() => {
    const id = window.setInterval(() => {
      const nextTick = tickRef.current;
      tickRef.current += 1;
      const { aeroMode: mode, speedKmh: target } = liveInputsRef.current;
      setSamples((prev) => {
        const last = prev[prev.length - 1];
        const nextSample = stepTelemetrySample(last, {
          aeroMode: mode,
          speedKmh: target,
          tick: nextTick,
        });
        return [...prev.slice(1), nextSample];
      });
    }, SAMPLE_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, []);

  // Push an immediate sample when aeroMode or speedKmh changes so the HUD reacts instantly
  const prevInputsRef = useRef({ aeroMode, speedKmh });
  useEffect(() => {
    if (
      prevInputsRef.current.aeroMode === aeroMode &&
      prevInputsRef.current.speedKmh === speedKmh
    ) {
      return;
    }
    prevInputsRef.current = { aeroMode, speedKmh };
    const nextTick = tickRef.current;
    tickRef.current += 1;
    setSamples((prev) => {
      const last = prev[prev.length - 1];
      const nextSample = stepTelemetrySample(last, {
        aeroMode,
        speedKmh,
        tick: nextTick,
      });
      return [...prev.slice(1), nextSample];
    });
  }, [aeroMode, speedKmh]);

  const latest = samples[samples.length - 1];
  const aeroMeta = getAeroCoefficients(aeroMode);
  const isXMode = aeroMode === 'x-mode';

  return (
    <section
      aria-label="Live Aero Telemetry"
      data-testid="telemetry-overlay"
      data-aero-mode={aeroMode}
      data-speed-kmh={speedKmh}
      className="pointer-events-auto absolute top-[78px] left-5 z-10 w-[280px] sm:w-[320px] rounded-xl border border-white/14 bg-[#0d1018]/92 shadow-xl overflow-hidden"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-display text-xs font-semibold tracking-wide text-white whitespace-nowrap">
            Aero Telemetry
          </h2>
          <span aria-hidden="true" className="text-slate-600 text-xs">
            ·
          </span>
          <span
            data-testid="telemetry-aero-mode"
            className={`text-[11px] font-medium whitespace-nowrap truncate ${
              isXMode ? 'text-cyan-400' : 'text-amber-400'
            }`}
          >
            {isXMode ? 'X-Mode' : 'Z-Mode'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand aero telemetry' : 'Collapse aero telemetry'}
          className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-white hover:bg-white/8 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 shrink-0"
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3.5 py-3 space-y-2.5">
          {/* Primary Tabular KPI Readouts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400">Speed</div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  data-testid="telemetry-speed"
                  className="font-mono-tech text-lg font-semibold leading-none text-amber-400"
                >
                  {latest.speed.toFixed(0)}
                </span>
                <span className="text-[11px] text-slate-400">km/h</span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="text-[11px] text-slate-400">Downforce</div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  data-testid="telemetry-downforce"
                  className="font-mono-tech text-lg font-semibold leading-none text-cyan-400"
                >
                  {latest.downforce.toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400">kN</span>
              </div>
            </div>
          </div>

          {/* Recharts Dual-Axis Real-Time Trace */}
          <div className="h-[124px] w-full" data-testid="telemetry-chart-container">
            <ResponsiveContainer width="100%" height={124} minWidth={0} minHeight={120}>
              <AreaChart data={samples} margin={{ top: 6, right: 4, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="telemetrySpeedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="telemetryDownforceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="timeLabel" hide />
                <YAxis
                  yAxisId="speed"
                  domain={[0, 360]}
                  ticks={[0, 180, 360]}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <YAxis
                  yAxisId="downforce"
                  orientation="right"
                  domain={[0, 16]}
                  ticks={[0, 8, 16]}
                  tick={{ fill: '#67e8f9', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={26}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0d1018',
                    borderColor: 'rgba(255,255,255,0.14)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    padding: '6px 8px',
                    color: '#f8fafc',
                  }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '2px' }}
                  formatter={(value, name) => {
                    const num = typeof value === 'number' ? value : Number(value ?? 0);
                    if (name === 'speed') return [`${num.toFixed(1)} km/h`, 'Speed'];
                    return [`${num.toFixed(2)} kN`, 'Downforce'];
                  }}
                />
                <Area
                  yAxisId="speed"
                  type="monotone"
                  dataKey="speed"
                  name="speed"
                  stroke="#f59e0b"
                  strokeWidth={1.8}
                  fill="url(#telemetrySpeedGrad)"
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="downforce"
                  type="monotone"
                  dataKey="downforce"
                  name="downforce"
                  stroke="#22d3ee"
                  strokeWidth={1.8}
                  fill="url(#telemetryDownforceGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quiet Footer Summary */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-0.5 bg-amber-400 inline-block" aria-hidden="true" />
                <span>Speed</span>
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-0.5 bg-cyan-400 inline-block" aria-hidden="true" />
                <span>Downforce</span>
              </span>
            </div>
            <span className="font-mono-tech text-slate-400 whitespace-nowrap">
              CdA {aeroMeta.cdA.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
