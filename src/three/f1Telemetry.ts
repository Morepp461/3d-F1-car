import { AeroMode } from './f1Chassis2026Spec';

export interface TelemetrySample {
  tick: number;
  timeLabel: string;
  speed: number;
  downforce: number;
  aeroMode: AeroMode;
}

const AIR_DENSITY_KG_M3 = 1.225;

export function getAeroCoefficients(aeroMode: AeroMode): {
  clA: number;
  cdA: number;
  label: string;
} {
  if (aeroMode === 'x-mode') {
    return {
      clA: 1.52,
      cdA: 0.56,
      label: 'X-Mode · Low Drag',
    };
  }
  return {
    clA: 2.85,
    cdA: 0.96,
    label: 'Z-Mode · High Downforce',
  };
}

/**
 * Computes aerodynamic downforce in kilonewtons (kN):
 * F = 0.5 * rho * (Cl * A) * v^2 / 1000
 */
export function computeAeroDownforceKn(speedKmh: number, aeroMode: AeroMode): number {
  const safeSpeed = Math.max(0, speedKmh);
  const metersPerSec = safeSpeed / 3.6;
  const { clA } = getAeroCoefficients(aeroMode);
  const newtons = 0.5 * AIR_DENSITY_KG_M3 * clA * metersPerSec * metersPerSec;
  return Number((newtons / 1000).toFixed(2));
}

/**
 * Computes effective target speed (km/h) accounting for 2026 Active Aero drag reduction.
 * In X-Mode (flattened flaps), lower drag yields ~5% higher cruising/terminal speed when moving.
 */
export function computeEffectiveTargetSpeedKmh(baseSpeedKmh: number, aeroMode: AeroMode): number {
  const safeSpeed = Math.max(0, baseSpeedKmh);
  if (safeSpeed <= 0.5) return 0;
  const dragBonus = aeroMode === 'x-mode' ? 1.05 : 1.0;
  return Number(Math.min(360, safeSpeed * dragBonus).toFixed(1));
}

export function formatTelemetryTickLabel(tick: number): string {
  const sec = (tick * 0.2).toFixed(1);
  return `${sec}s`;
}

export function stepTelemetrySample(
  prev: TelemetrySample,
  params: { speedKmh: number; aeroMode: AeroMode; tick: number },
): TelemetrySample {
  const targetSpeed = computeEffectiveTargetSpeedKmh(params.speedKmh, params.aeroMode);
  const smoothing = targetSpeed === 0 ? 0.48 : 0.36;
  let nextSpeed = prev.speed + (targetSpeed - prev.speed) * smoothing;

  if (targetSpeed === 0 && nextSpeed < 0.35) {
    nextSpeed = 0;
  } else if (targetSpeed > 0) {
    // Subtle deterministic aero micro-ripple for live streaming readability
    const ripple = Math.sin(params.tick * 0.85) * 0.65 + Math.cos(params.tick * 0.42) * 0.35;
    nextSpeed = Math.max(0, Math.min(360, nextSpeed + ripple));
  }

  const roundedSpeed = Number(nextSpeed.toFixed(1));
  const downforce = computeAeroDownforceKn(roundedSpeed, params.aeroMode);

  return {
    tick: params.tick,
    timeLabel: formatTelemetryTickLabel(params.tick),
    speed: roundedSpeed,
    downforce,
    aeroMode: params.aeroMode,
  };
}

export function createInitialTelemetryHistory(
  speedKmh: number,
  aeroMode: AeroMode,
  length = 28,
): TelemetrySample[] {
  const baseSpeed = computeEffectiveTargetSpeedKmh(speedKmh, aeroMode);
  const baseDownforce = computeAeroDownforceKn(baseSpeed, aeroMode);
  const samples: TelemetrySample[] = [];
  for (let i = 0; i < length; i += 1) {
    samples.push({
      tick: i,
      timeLabel: formatTelemetryTickLabel(i),
      speed: baseSpeed,
      downforce: baseDownforce,
      aeroMode,
    });
  }
  return samples;
}
