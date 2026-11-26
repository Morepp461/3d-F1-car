import test from 'node:test';
import assert from 'node:assert/strict';
import {
  F1_2026_DIMENSIONS,
  LIVERY_PRESETS,
  TIRE_COMPOUNDS,
  CAMERA_PRESETS,
  CHASSIS_MODULES,
  getAeroFlapAngles,
  computeAckermannSteerAngles,
  speedKmhToWheelOmega,
  generateGameIntegrationSnippet,
  generateGltfCompressCliCommand,
  getLodSegmentBudget,
} from './f1Chassis2026Spec';
import {
  DECAL_DESIGNS,
  SPONSOR_SLOTS,
  createDefaultSponsorSlots,
  getCrashPreset,
  normalizeHexColor,
  sanitizeCarNumber,
} from './f1Decals';

test('2026 FIA chassis dimensions obey narrower and shorter regulations', () => {
  assert.equal(F1_2026_DIMENSIONS.wheelbase, 3.4);
  assert.equal(F1_2026_DIMENSIONS.maxWidth, 1.9);
  assert.equal(F1_2026_DIMENSIONS.frontAxleZ - F1_2026_DIMENSIONS.rearAxleZ, F1_2026_DIMENSIONS.wheelbase);
  assert.ok(F1_2026_DIMENSIONS.frontWingSpan <= F1_2026_DIMENSIONS.maxWidth);
  assert.ok(F1_2026_DIMENSIONS.frontTireWidth < F1_2026_DIMENSIONS.rearTireWidth);
});

test('Active Aero X-Mode flattens wing flaps compared to Z-Mode', () => {
  const zAngles = getAeroFlapAngles('z-mode');
  const xAngles = getAeroFlapAngles('x-mode');
  assert.equal(zAngles.rearFlapPitch, 0);
  assert.ok(xAngles.rearFlapPitch < 0);
  assert.ok(xAngles.frontFlap1Pitch < 0);
  assert.ok(xAngles.frontFlap2Pitch < xAngles.frontFlap1Pitch);
});

test('Ackermann steering gives inner wheel sharper angle and clamps input', () => {
  const center = computeAckermannSteerAngles(0);
  assert.equal(center.leftRad, 0);
  assert.equal(center.rightRad, 0);

  const leftTurn = computeAckermannSteerAngles(0.8);
  assert.ok(leftTurn.leftRad > leftTurn.rightRad);

  const overClamped = computeAckermannSteerAngles(5.0);
  const exactMax = computeAckermannSteerAngles(1.0);
  assert.equal(overClamped.leftRad, exactMax.leftRad);
});

test('Wheel angular velocity matches v / r physics', () => {
  assert.equal(speedKmhToWheelOmega(0), 0);
  const omega36 = speedKmhToWheelOmega(36); // 10 m/s
  assert.ok(Math.abs(omega36 - 10 / F1_2026_DIMENSIONS.wheelRadius) < 1e-6);
});

test('Low-poly Game LOD cuts segment counts significantly vs High Detail', () => {
  const low = getLodSegmentBudget('game-low');
  const high = getLodSegmentBudget('studio-high');
  assert.ok(low.loftRadial < high.loftRadial);
  assert.ok(low.tireRadial < high.tireRadial);
  assert.ok(low.airfoilSteps < high.airfoilSteps);
  assert.ok(low.haloTubular < high.haloTubular);
});

test('50 unique decal designs, 8 sponsor slots, hex normalizer, car number, and crash presets work cleanly', () => {
  assert.equal(DECAL_DESIGNS.length, 50);
  const uniqueIds = new Set(DECAL_DESIGNS.map((d) => d.id));
  assert.equal(uniqueIds.size, 50);

  assert.equal(SPONSOR_SLOTS.length, 8);
  const slots = createDefaultSponsorSlots();
  assert.equal(Object.keys(slots).length, 8);
  assert.equal(slots['slot-1'].enabled, true);
  assert.equal(slots['slot-8'].logoDataUrl, null);

  assert.equal(normalizeHexColor('ff6b00'), '#ff6b00');
  assert.equal(normalizeHexColor('#ABC'), '#aabbcc');
  assert.equal(normalizeHexColor('invalid', '#123456'), '#123456');

  assert.equal(sanitizeCarNumber('1'), '1');
  assert.equal(sanitizeCarNumber('44'), '44');
  assert.equal(sanitizeCarNumber('99'), '99');
  assert.equal(sanitizeCarNumber('05'), '5');
  assert.equal(sanitizeCarNumber('120'), '99');
  assert.equal(sanitizeCarNumber('0'), '26');
  assert.equal(sanitizeCarNumber('00'), '26');
  assert.equal(sanitizeCarNumber('!!!'), '26');

  const intact = getCrashPreset('intact');
  assert.equal(intact.decalPeel, 0);
  assert.equal(intact.frontWingBreak, 'none');

  const heavy = getCrashPreset('heavy');
  assert.equal(heavy.decalPeel, 1);
  assert.equal(heavy.frontWingBreak, 'both');
  assert.equal(heavy.suspensionBent, true);
  assert.equal(heavy.debrisVisible, true);
});

test('All presets, chassis modules, and KTX2/Draco snippets are populated', () => {
  assert.equal(LIVERY_PRESETS.length, 6);
  assert.equal(TIRE_COMPOUNDS.length, 5);
  assert.equal(CAMERA_PRESETS.length, 6);
  assert.equal(CHASSIS_MODULES.length, 8);
  const snippet = generateGameIntegrationSnippet('papaya-carbon', 'soft', 'game-low');
  assert.match(snippet, /KTX2Loader/);
  assert.match(snippet, /DRACOLoader/);
  const cli = generateGltfCompressCliCommand('papaya-carbon');
  assert.match(cli, /--texture-compress ktx2/);
});
