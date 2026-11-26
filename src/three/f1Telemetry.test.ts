import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAeroDownforceKn,
  computeEffectiveTargetSpeedKmh,
  createInitialTelemetryHistory,
  getAeroCoefficients,
  stepTelemetrySample,
} from './f1Telemetry';

test('Z-Mode produces significantly higher downforce than X-Mode at race speed', () => {
  const zForce = computeAeroDownforceKn(320, 'z-mode');
  const xForce = computeAeroDownforceKn(320, 'x-mode');
  assert.ok(zForce > xForce * 1.7);
  assert.equal(computeAeroDownforceKn(0, 'z-mode'), 0);
  assert.equal(computeAeroDownforceKn(0, 'x-mode'), 0);
});

test('Downforce scales quadratically with speed', () => {
  const f120 = computeAeroDownforceKn(120, 'z-mode');
  const f240 = computeAeroDownforceKn(240, 'z-mode');
  const ratio = f240 / f120;
  assert.ok(Math.abs(ratio - 4) < 0.05);
});

test('X-Mode low drag increases effective target speed when car is moving', () => {
  assert.equal(computeEffectiveTargetSpeedKmh(0, 'x-mode'), 0);
  assert.equal(computeEffectiveTargetSpeedKmh(120, 'z-mode'), 120);
  assert.ok(computeEffectiveTargetSpeedKmh(320, 'x-mode') > 320);
  assert.equal(getAeroCoefficients('x-mode').cdA < getAeroCoefficients('z-mode').cdA, true);
});

test('Telemetry stream steps smoothly toward target speed and settles at idle', () => {
  let history = createInitialTelemetryHistory(0, 'z-mode', 20);
  assert.equal(history.length, 20);
  assert.equal(history[19].speed, 0);
  assert.equal(history[19].downforce, 0);

  let latest = history[history.length - 1];
  for (let i = 1; i <= 15; i += 1) {
    latest = stepTelemetrySample(latest, {
      speedKmh: 320,
      aeroMode: 'z-mode',
      tick: 20 + i,
    });
  }
  assert.ok(latest.speed > 300);
  assert.ok(latest.downforce > 12);

  // Switching to X-Mode drops downforce immediately while keeping speed high
  const xNext = stepTelemetrySample(latest, {
    speedKmh: 320,
    aeroMode: 'x-mode',
    tick: 36,
  });
  assert.ok(xNext.downforce < latest.downforce * 0.65);

  // Returning to Idle decays speed smoothly back to 0
  let idleSample = xNext;
  for (let i = 1; i <= 25; i += 1) {
    idleSample = stepTelemetrySample(idleSample, {
      speedKmh: 0,
      aeroMode: 'x-mode',
      tick: 36 + i,
    });
  }
  assert.equal(idleSample.speed, 0);
  assert.equal(idleSample.downforce, 0);
});
