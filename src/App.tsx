import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { BookOpen, Download } from 'lucide-react';
import { F1ViewportCanvas } from './components/F1ViewportCanvas';
import { ControlDock } from './components/ControlDock';
import { AssetCodeModal } from './components/AssetCodeModal';
import { AssetMeshStats } from './three/createF1Car2026';
import {
  AeroMode,
  AssetLodTier,
  CameraPresetId,
  ChassisModuleId,
  LiveryId,
  TireCompoundId,
  getLiveryPreset,
} from './three/f1Chassis2026Spec';
import {
  CrashEffectState,
  DECAL_DESIGNS,
  SponsorSlotConfig,
  SponsorSlotId,
  createDefaultSponsorSlots,
  getCrashPreset,
} from './three/f1Decals';
import { F1AppearanceConfig } from './three/f1Materials';
import { exportObjectToGLB } from './three/exportAsset';

export default function App() {
  const initialLiveryPreset = getLiveryPreset('rosso-corsa');
  const [livery, setLivery] = useState<LiveryId>('rosso-corsa');
  const [primaryHex, setPrimaryHex] = useState<string>(initialLiveryPreset.primary);
  const [secondaryHex, setSecondaryHex] = useState<string>(initialLiveryPreset.secondary);
  const [decalHex, setDecalHex] = useState<string>(initialLiveryPreset.accent);
  const [accentHex, setAccentHex] = useState<string>(initialLiveryPreset.rimAccent);
  const [decalId, setDecalId] = useState<string>(DECAL_DESIGNS[0].id);
  const [carNumber, setCarNumber] = useState<string>(initialLiveryPreset.numberText);
  const [sponsorSlots, setSponsorSlots] = useState<Record<SponsorSlotId, SponsorSlotConfig>>(
    () => createDefaultSponsorSlots(),
  );
  const [crashState, setCrashState] = useState<CrashEffectState>(() => getCrashPreset('intact'));

  const [tireCompound, setTireCompound] = useState<TireCompoundId>('soft');
  const [aeroMode, setAeroMode] = useState<AeroMode>('z-mode');
  const [lod, setLod] = useState<AssetLodTier>('game-low');
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [steerNormalized, setSteerNormalized] = useState<number>(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('hero');
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [codeModalOpen, setCodeModalOpen] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [stats, setStats] = useState<AssetMeshStats | null>(null);
  const [hiddenModules, setHiddenModules] = useState<Record<ChassisModuleId, boolean>>({
    front_wing: false,
    nose_monocoque: false,
    halo_cockpit: false,
    sidepods_engine_cover: false,
    floor_diffuser: false,
    rear_wing: false,
    suspension_system: false,
    wheels_tires: false,
  });

  const exportTargetGetterRef = useRef<() => THREE.Group | null>(() => null);

  const handleRegisterExporter = useCallback((fn: () => THREE.Group | null) => {
    exportTargetGetterRef.current = fn;
  }, []);

  const handleSelectCameraPreset = useCallback((id: CameraPresetId) => {
    setCameraPreset(id);
    setCameraPresetTrigger((n) => n + 1);
  }, []);

  const handleToggleModule = useCallback((id: ChassisModuleId) => {
    setHiddenModules((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSelectLiveryPreset = useCallback((id: LiveryId) => {
    const preset = getLiveryPreset(id);
    setLivery(id);
    setPrimaryHex(preset.primary);
    setSecondaryHex(preset.secondary);
    setDecalHex(preset.accent);
    setAccentHex(preset.rimAccent);
    setCarNumber(preset.numberText);
  }, []);

  const handleUpdateSponsorSlot = useCallback(
    (id: SponsorSlotId, patch: Partial<SponsorSlotConfig>) => {
      setSponsorSlots((prev) => ({
        ...prev,
        [id]: { ...prev[id], ...patch },
      }));
    },
    [],
  );

  const handleResetSponsorSlots = useCallback(() => {
    setSponsorSlots(createDefaultSponsorSlots());
  }, []);

  const handleShowAllModules = useCallback(() => {
    setHiddenModules({
      front_wing: false,
      nose_monocoque: false,
      halo_cockpit: false,
      sidepods_engine_cover: false,
      floor_diffuser: false,
      rear_wing: false,
      suspension_system: false,
      wheels_tires: false,
    });
  }, []);

  const handleExportGLB = useCallback(async () => {
    const group = exportTargetGetterRef.current();
    if (!group || exporting) return;
    setExporting(true);
    setExportFeedback(null);
    try {
      const suffix = lod === 'game-low' ? 'lowpoly' : 'high';
      const byteLength = await exportObjectToGLB(group, `f1-2026-${livery}-${suffix}.glb`);
      const kb = Math.round(byteLength / 1024);
      setExportFeedback(`Exported f1-2026-${livery}-${suffix}.glb (${kb} KB)`);
      setTimeout(() => setExportFeedback(null), 3500);
    } catch {
      setExportFeedback('Export failed. Try resetting visibility.');
    } finally {
      setExporting(false);
    }
  }, [livery, lod, exporting]);

  // Keyboard shortcuts: H toggles dock, X toggles Active Aero, A/D steers front wheels
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'x' || e.key === 'X') {
        setAeroMode((prev) => (prev === 'z-mode' ? 'x-mode' : 'z-mode'));
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        setSteerNormalized((prev) => Math.min(1, Number((prev + 0.25).toFixed(2))));
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        setSteerNormalized((prev) => Math.max(-1, Number((prev - 0.25).toFixed(2))));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeLivery = getLiveryPreset(livery);

  const appearance: F1AppearanceConfig = useMemo(
    () => ({
      primaryHex,
      secondaryHex,
      decalHex,
      accentHex,
      decalId,
      carNumber,
      sponsorSlots,
      decalPeel: crashState.decalPeel,
      metalness: activeLivery.metalness,
      roughness: activeLivery.roughness,
      clearcoat: activeLivery.clearcoat,
      rimAccent: accentHex,
    }),
    [
      primaryHex,
      secondaryHex,
      decalHex,
      accentHex,
      decalId,
      carNumber,
      sponsorSlots,
      crashState.decalPeel,
      activeLivery.metalness,
      activeLivery.roughness,
      activeLivery.clearcoat,
    ],
  );

  return (
    <main
      className="relative w-screen h-screen overflow-hidden bg-[#0c0f16] select-none"
      data-livery={livery}
      data-decal={decalId}
      data-aero={aeroMode}
      data-lod={lod}
      data-crash={crashState.frontWingBreak !== 'none' || crashState.decalPeel > 0 ? 'damaged' : 'intact'}
      data-explode={explodeFactor.toFixed(2)}
    >
      {/* Full-Bleed Three.js Viewport */}
      <F1ViewportCanvas
        livery={livery}
        appearance={appearance}
        crashState={crashState}
        tireCompound={tireCompound}
        aeroMode={aeroMode}
        lod={lod}
        explodeFactor={explodeFactor}
        speedKmh={speedKmh}
        steerNormalized={steerNormalized}
        cameraPreset={cameraPreset}
        cameraPresetTrigger={cameraPresetTrigger}
        autoRotate={autoRotate}
        hiddenModules={hiddenModules}
        onStatsReady={setStats}
        onRegisterExporter={handleRegisterExporter}
      />

      {/* Minimal Top Bar Overlay (Zero center occlusion) */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-4 px-5 py-4 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
            Apex 2026 F1 Chassis
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 whitespace-nowrap">
            <span>{activeLivery.name}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tech">3.40m Wheelbase</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tech text-amber-400" data-testid="triangle-count">
              {stats ? `${stats.triangles.toLocaleString()} tris` : 'Game Asset'}
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          {exportFeedback && (
            <span className="hidden lg:inline text-xs font-medium text-emerald-400 mr-1">
              {exportFeedback}
            </span>
          )}
          <div
            role="group"
            aria-label="Polygon LOD Preset"
            className="hidden sm:flex items-center p-0.5 rounded-lg border border-white/15 bg-[#0d1018]/95"
          >
            <button
              type="button"
              onClick={() => setLod('game-low')}
              aria-pressed={lod === 'game-low'}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                lod === 'game-low'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Low-Poly Game
            </button>
            <button
              type="button"
              onClick={() => setLod('studio-high')}
              aria-pressed={lod === 'studio-high'}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                lod === 'studio-high'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              High Detail
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCodeModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/15 bg-[#0d1018]/95 text-xs font-medium text-slate-200 hover:text-white hover:border-white/30 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Optimization & Code</span>
          </button>
          <button
            type="button"
            onClick={handleExportGLB}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-white"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Exporting...' : 'Export GLB'}</span>
          </button>
        </div>
      </header>

      {/* Collapsible Bottom Control Dock */}
      <ControlDock
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
        aeroMode={aeroMode}
        onChangeAeroMode={setAeroMode}
        explodeFactor={explodeFactor}
        onChangeExplodeFactor={setExplodeFactor}
        speedKmh={speedKmh}
        onChangeSpeedKmh={setSpeedKmh}
        steerNormalized={steerNormalized}
        onChangeSteerNormalized={setSteerNormalized}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate((prev) => !prev)}
        livery={livery}
        onSelectLiveryPreset={handleSelectLiveryPreset}
        primaryHex={primaryHex}
        onChangePrimaryHex={setPrimaryHex}
        decalHex={decalHex}
        onChangeDecalHex={setDecalHex}
        accentHex={accentHex}
        onChangeAccentHex={setAccentHex}
        decalId={decalId}
        onChangeDecalId={setDecalId}
        carNumber={carNumber}
        onChangeCarNumber={setCarNumber}
        sponsorSlots={sponsorSlots}
        onUpdateSponsorSlot={handleUpdateSponsorSlot}
        onResetSponsorSlots={handleResetSponsorSlots}
        crashState={crashState}
        onChangeCrashState={setCrashState}
        tireCompound={tireCompound}
        onChangeTireCompound={setTireCompound}
        cameraPreset={cameraPreset}
        onSelectCameraPreset={handleSelectCameraPreset}
        hiddenModules={hiddenModules}
        onToggleModule={handleToggleModule}
        onShowAllModules={handleShowAllModules}
      />

      {/* Game Asset Optimization & Integration Modal */}
      <AssetCodeModal
        open={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        livery={livery}
        tireCompound={tireCompound}
        lod={lod}
        stats={stats}
        onExportGLB={handleExportGLB}
        exporting={exporting}
      />
    </main>
  );
}
