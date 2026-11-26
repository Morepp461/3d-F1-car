import { ChangeEvent, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Gauge,
  Hash,
  Palette,
  RotateCw,
  Upload,
  Wind,
  X,
} from 'lucide-react';
import {
  AeroMode,
  CAMERA_PRESETS,
  CHASSIS_MODULES,
  CameraPresetId,
  ChassisModuleId,
  LIVERY_PRESETS,
  LiveryId,
  TIRE_COMPOUNDS,
  TireCompoundId,
} from '../three/f1Chassis2026Spec';
import {
  CrashEffectState,
  DECAL_DESIGNS,
  DecalDesignSpec,
  SPONSOR_SLOTS,
  SponsorSlotConfig,
  SponsorSlotId,
  getCrashPreset,
  normalizeHexColor,
} from '../three/f1Decals';

type DockTab = 'aero' | 'livery' | 'sponsor' | 'crash' | 'camera';

interface ControlDockProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  aeroMode: AeroMode;
  onChangeAeroMode: (mode: AeroMode) => void;
  explodeFactor: number;
  onChangeExplodeFactor: (value: number) => void;
  speedKmh: number;
  onChangeSpeedKmh: (speed: number) => void;
  steerNormalized: number;
  onChangeSteerNormalized: (steer: number) => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  livery: LiveryId;
  onSelectLiveryPreset: (id: LiveryId) => void;
  primaryHex: string;
  onChangePrimaryHex: (hex: string) => void;
  decalHex: string;
  onChangeDecalHex: (hex: string) => void;
  accentHex: string;
  onChangeAccentHex: (hex: string) => void;
  decalId: string;
  onChangeDecalId: (id: string) => void;
  carNumber: string;
  onChangeCarNumber: (num: string) => void;
  sponsorSlots: Record<SponsorSlotId, SponsorSlotConfig>;
  onUpdateSponsorSlot: (id: SponsorSlotId, patch: Partial<SponsorSlotConfig>) => void;
  onResetSponsorSlots: () => void;
  crashState: CrashEffectState;
  onChangeCrashState: (next: CrashEffectState) => void;
  tireCompound: TireCompoundId;
  onChangeTireCompound: (id: TireCompoundId) => void;
  cameraPreset: CameraPresetId;
  onSelectCameraPreset: (id: CameraPresetId) => void;
  hiddenModules: Record<ChassisModuleId, boolean>;
  onToggleModule: (id: ChassisModuleId) => void;
  onShowAllModules: () => void;
}

function HexColorControl({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  testId: string;
}) {
  const [draft, setDraft] = useState(value);
  const lastPropRef = useRef(value);
  if (lastPropRef.current !== value) {
    lastPropRef.current = value;
    if (draft !== value) setDraft(value);
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-white/12 bg-black/35 px-2 py-1">
      <label className="relative flex items-center cursor-pointer shrink-0" title={`${label} Color Picker`}>
        <input
          type="color"
          aria-label={`${label} color picker`}
          data-testid={`${testId}-picker`}
          value={normalizeHexColor(value)}
          onChange={(e) => {
            const hex = e.target.value.toLowerCase();
            setDraft(hex);
            onChange(hex);
          }}
          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
        />
      </label>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] leading-none text-slate-400">{label}</span>
        <input
          type="text"
          aria-label={`${label} hex input`}
          data-testid={`${testId}-hex`}
          value={draft}
          maxLength={7}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            if (/^#?[0-9a-fA-F]{6}$/.test(raw.trim())) {
              onChange(normalizeHexColor(raw));
            }
          }}
          onBlur={() => setDraft(value)}
          className="w-[62px] bg-transparent text-[11px] font-mono-tech text-white focus:outline-none uppercase"
        />
      </div>
    </div>
  );
}

export function ControlDock({
  collapsed,
  onToggleCollapse,
  aeroMode,
  onChangeAeroMode,
  explodeFactor,
  onChangeExplodeFactor,
  speedKmh,
  onChangeSpeedKmh,
  steerNormalized,
  onChangeSteerNormalized,
  autoRotate,
  onToggleAutoRotate,
  livery,
  onSelectLiveryPreset,
  primaryHex,
  onChangePrimaryHex,
  decalHex,
  onChangeDecalHex,
  accentHex,
  onChangeAccentHex,
  decalId,
  onChangeDecalId,
  carNumber,
  onChangeCarNumber,
  sponsorSlots,
  onUpdateSponsorSlot,
  onResetSponsorSlots,
  crashState,
  onChangeCrashState,
  tireCompound,
  onChangeTireCompound,
  cameraPreset,
  onSelectCameraPreset,
  hiddenModules,
  onToggleModule,
  onShowAllModules,
}: ControlDockProps) {
  const [activeTab, setActiveTab] = useState<DockTab>('aero');
  const [selectedSlotId, setSelectedSlotId] = useState<SponsorSlotId>('slot-1');
  const [decalCategory, setDecalCategory] = useState<'all' | DecalDesignSpec['category']>('all');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredDecals = useMemo(() => {
    if (decalCategory === 'all') return DECAL_DESIGNS;
    return DECAL_DESIGNS.filter((d) => d.category === decalCategory);
  }, [decalCategory]);

  const currentDecalIndex = useMemo(
    () => DECAL_DESIGNS.findIndex((d) => d.id === decalId),
    [decalId],
  );

  const stepDecal = (delta: number) => {
    const idx = currentDecalIndex >= 0 ? currentDecalIndex : 0;
    const nextIdx = (idx + delta + DECAL_DESIGNS.length) % DECAL_DESIGNS.length;
    onChangeDecalId(DECAL_DESIGNS[nextIdx].id);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateSponsorSlot(selectedSlotId, { logoDataUrl: reader.result, enabled: true });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const tabs: { id: DockTab; label: string; icon: typeof Wind }[] = [
    { id: 'aero', label: 'Aero & Drive', icon: Wind },
    { id: 'livery', label: '50 Decals & Hex', icon: Palette },
    { id: 'sponsor', label: 'Number & 8 Sponsors', icon: Hash },
    { id: 'crash', label: 'Crash FX', icon: AlertTriangle },
    { id: 'camera', label: 'Camera & Parts', icon: Camera },
  ];

  const selectedSlotMeta = SPONSOR_SLOTS.find((s) => s.id === selectedSlotId) ?? SPONSOR_SLOTS[0];
  const selectedSlotCfg = sponsorSlots[selectedSlotId];

  const hiddenCount = Object.values(hiddenModules).filter(Boolean).length;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none"
      style={{ width: 'min(960px, 95vw)' }}
    >
      {/* Collapse / Expand Handle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show Controls' : 'Hide Controls'}
        className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-white/15 bg-[#0c0f16]/95 text-xs font-medium text-slate-300 hover:text-white hover:border-white/30 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Show Controls</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
            <span>Hide Controls</span>
          </>
        )}
      </button>

      {!collapsed && (
        <section
          aria-label="3D Asset Controls"
          className="pointer-events-auto w-full rounded-xl border border-white/14 bg-[#0d1018]/96 shadow-2xl overflow-hidden"
        >
          {/* Tab Strip + Quick Turntable Toggle */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10">
            <div role="tablist" aria-label="Control categories" className="flex items-center gap-1 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onToggleAutoRotate}
              aria-pressed={autoRotate}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400 ${
                autoRotate
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                  : 'border-white/12 bg-white/5 text-slate-300 hover:text-white'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Turntable</span>
            </button>
          </div>

          {/* Active Tab Content */}
          <div className="px-4 py-3">
            {activeTab === 'aero' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-slate-400">Active Aero Wings</span>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-black/40 border border-white/10">
                    <button
                      type="button"
                      onClick={() => onChangeAeroMode('z-mode')}
                      aria-pressed={aeroMode === 'z-mode'}
                      className={`px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                        aeroMode === 'z-mode'
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Z-Mode · Grip
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeAeroMode('x-mode')}
                      aria-pressed={aeroMode === 'x-mode'}
                      className={`px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                        aeroMode === 'x-mode'
                          ? 'bg-cyan-400 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      X-Mode · Drag
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <label htmlFor="explode-slider" className="font-medium text-slate-400">
                      Exploded Assembly
                    </label>
                    <span className="font-mono-tech text-amber-400">
                      {Math.round(explodeFactor * 100)}%
                    </span>
                  </div>
                  <input
                    id="explode-slider"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={explodeFactor}
                    onChange={(e) => onChangeExplodeFactor(parseFloat(e.target.value))}
                    className="studio-slider w-full"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-400 inline-flex items-center gap-1">
                      <Gauge className="w-3 h-3" />
                      Wheel Spin
                    </span>
                    <span className="font-mono-tech text-slate-200">{speedKmh} km/h</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[0, 120, 320].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => onChangeSpeedKmh(spd)}
                        aria-pressed={speedKmh === spd}
                        className={`px-2 py-1.5 rounded text-xs font-mono-tech border transition-colors whitespace-nowrap ${
                          speedKmh === spd
                            ? 'border-amber-500/70 bg-amber-500/20 text-amber-300'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
                        }`}
                      >
                        {spd === 0 ? 'Idle' : `${spd}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <label htmlFor="steer-slider" className="font-medium text-slate-400">
                      Front Steering
                    </label>
                    <span className="font-mono-tech text-slate-200">
                      {Math.round(steerNormalized * 24)}°
                    </span>
                  </div>
                  <input
                    id="steer-slider"
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={steerNormalized}
                    onChange={(e) => onChangeSteerNormalized(parseFloat(e.target.value))}
                    className="studio-slider w-full"
                  />
                </div>
              </div>
            )}

            {activeTab === 'livery' && (
              <div className="space-y-2.5">
                {/* Row 1: Unlimited Hex Pickers + 50 Decal Selector */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <HexColorControl
                      label="Body Hex"
                      value={primaryHex}
                      onChange={onChangePrimaryHex}
                      testId="body-color"
                    />
                    <HexColorControl
                      label="Decal Hex"
                      value={decalHex}
                      onChange={onChangeDecalHex}
                      testId="decal-color"
                    />
                    <HexColorControl
                      label="Accent Hex"
                      value={accentHex}
                      onChange={onChangeAccentHex}
                      testId="accent-color"
                    />
                  </div>

                  {/* 50 Decals Selector + Filter */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      aria-label="Filter decal category"
                      value={decalCategory}
                      onChange={(e) => {
                        const cat = e.target.value as 'all' | DecalDesignSpec['category'];
                        setDecalCategory(cat);
                      }}
                      className="rounded-md border border-white/15 bg-black/45 px-2 py-1.5 text-xs text-slate-200 focus:outline-amber-400"
                    >
                      <option value="all">All (50)</option>
                      <option value="aero">Aero (10)</option>
                      <option value="racing">Racing (12)</option>
                      <option value="tech">Tech (10)</option>
                      <option value="geometric">Geometric (9)</option>
                      <option value="heritage">Heritage (9)</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => stepDecal(-1)}
                      aria-label="Previous decal design"
                      className="p-1.5 rounded-md border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <select
                      aria-label="Select 50 decal design"
                      data-testid="decal-select"
                      value={decalId}
                      onChange={(e) => onChangeDecalId(e.target.value)}
                      className="rounded-md border border-amber-400/50 bg-black/55 px-2.5 py-1.5 text-xs font-medium text-white min-w-[200px] focus:outline-amber-400"
                    >
                      {filteredDecals.map((d) => (
                        <option key={d.id} value={d.id}>
                          #{String(d.index).padStart(2, '0')} · {d.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => stepDecal(1)}
                      aria-label="Next decal design"
                      className="p-1.5 rounded-md border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Quick Team Presets + Tire Compound */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/8">
                  <div className="flex flex-wrap items-center gap-1">
                    {LIVERY_PRESETS.map((preset) => {
                      const active = livery === preset.id && primaryHex.toLowerCase() === preset.primary.toLowerCase();
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onSelectLiveryPreset(preset.id)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] transition-colors whitespace-nowrap ${
                            active
                              ? 'border-amber-400 bg-white/12 text-white font-semibold'
                              : 'border-white/10 bg-white/4 text-slate-300 hover:text-white'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-sm border border-white/25 shrink-0"
                            style={{ backgroundColor: preset.primary }}
                          />
                          <span>{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1">
                    {TIRE_COMPOUNDS.map((comp) => {
                      const active = tireCompound === comp.id;
                      return (
                        <button
                          key={comp.id}
                          type="button"
                          onClick={() => onChangeTireCompound(comp.id)}
                          aria-pressed={active}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-mono-tech transition-colors whitespace-nowrap ${
                            active
                              ? 'border-amber-400 bg-white/12 text-white font-semibold'
                              : 'border-white/10 bg-white/4 text-slate-300 hover:text-white'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: comp.stripeColor }}
                          />
                          <span>{comp.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sponsor' && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Car Racing Number (1-99) */}
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="car-number-input" className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                      Car Number (1–99):
                    </label>
                    <button
                      type="button"
                      aria-label="Decrease car number"
                      onClick={() => {
                        const n = Number.parseInt(carNumber, 10) || 26;
                        onChangeCarNumber(String(n <= 1 ? 99 : n - 1));
                      }}
                      className="px-1.5 py-1 rounded border border-white/12 bg-white/5 text-xs text-slate-300 hover:text-white"
                    >
                      −
                    </button>
                    <input
                      id="car-number-input"
                      data-testid="car-number-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={carNumber}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                        if (digits === '') {
                          onChangeCarNumber('');
                          return;
                        }
                        const parsed = Number.parseInt(digits, 10);
                        if (parsed >= 1 && parsed <= 99) {
                          onChangeCarNumber(String(parsed));
                        }
                      }}
                      onBlur={() => {
                        const parsed = Number.parseInt(carNumber, 10);
                        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 99) {
                          onChangeCarNumber('26');
                        }
                      }}
                      placeholder="26"
                      className="w-12 rounded-md border border-white/15 bg-black/50 px-1.5 py-1 text-sm font-display font-bold text-amber-400 text-center focus:outline-amber-400"
                    />
                    <button
                      type="button"
                      aria-label="Increase car number"
                      onClick={() => {
                        const n = Number.parseInt(carNumber, 10) || 26;
                        onChangeCarNumber(String(n >= 99 ? 1 : n + 1));
                      }}
                      className="px-1.5 py-1 rounded border border-white/12 bg-white/5 text-xs text-slate-300 hover:text-white"
                    >
                      +
                    </button>
                    <select
                      aria-label="Pick car number 1 to 99"
                      data-testid="car-number-select"
                      value={Number.parseInt(carNumber, 10) >= 1 && Number.parseInt(carNumber, 10) <= 99 ? String(Number.parseInt(carNumber, 10)) : '26'}
                      onChange={(e) => onChangeCarNumber(e.target.value)}
                      className="rounded-md border border-white/15 bg-black/50 px-1.5 py-1 text-xs font-mono-tech text-slate-200 focus:outline-amber-400"
                    >
                      {Array.from({ length: 99 }, (_, idx) => String(idx + 1)).map((num) => (
                        <option key={num} value={num}>
                          #{num}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected Sponsor Slot Editor */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-mono-tech text-amber-400 whitespace-nowrap">
                      Slot 0{selectedSlotMeta.index} ({selectedSlotMeta.name}):
                    </span>
                    <input
                      data-testid="sponsor-text-input"
                      type="text"
                      maxLength={14}
                      value={selectedSlotCfg.customText}
                      onChange={(e) =>
                        onUpdateSponsorSlot(selectedSlotId, {
                          customText: e.target.value,
                          enabled: true,
                        })
                      }
                      placeholder="Optional test text..."
                      className="w-36 rounded-md border border-white/15 bg-black/50 px-2 py-1 text-xs text-white uppercase focus:outline-amber-400"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/15 bg-white/5 text-xs text-slate-200 hover:bg-white/10 whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload Logo</span>
                    </button>
                    {(selectedSlotCfg.logoDataUrl || selectedSlotCfg.customText) && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSponsorSlot(selectedSlotId, {
                            logoDataUrl: null,
                            customText: '',
                          })
                        }
                        aria-label="Reset slot to template"
                        className="p-1 rounded-md border border-white/15 bg-white/5 text-slate-300 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSponsorSlot(selectedSlotId, { enabled: !selectedSlotCfg.enabled })
                      }
                      aria-pressed={selectedSlotCfg.enabled}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] transition-colors whitespace-nowrap ${
                        selectedSlotCfg.enabled
                          ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                          : 'border-white/12 bg-black/40 text-slate-500'
                      }`}
                    >
                      {selectedSlotCfg.enabled ? (
                        <Eye className="w-3 h-3" />
                      ) : (
                        <EyeOff className="w-3 h-3" />
                      )}
                      <span>{selectedSlotCfg.enabled ? 'Visible' : 'Hidden'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onResetSponsorSlots}
                      className="px-2 py-1 rounded-md border border-white/12 bg-white/5 text-[11px] text-slate-300 hover:text-white whitespace-nowrap"
                    >
                      Reset 8
                    </button>
                  </div>
                </div>

                {/* 8 Independent Sponsor Slots Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-white/8">
                  {SPONSOR_SLOTS.map((slot) => {
                    const cfg = sponsorSlots[slot.id];
                    const isSelected = selectedSlotId === slot.id;
                    const hasCustom = Boolean(cfg.logoDataUrl || cfg.customText.trim());
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        data-testid={`sponsor-${slot.id}`}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] transition-colors text-left ${
                          isSelected
                            ? 'border-amber-400 bg-amber-500/15 text-white font-semibold'
                            : cfg.enabled
                              ? 'border-white/12 bg-white/5 text-slate-300 hover:border-white/25'
                              : 'border-white/8 bg-black/30 text-slate-500'
                        }`}
                      >
                        <span className="truncate">
                          <span className="font-mono-tech text-amber-400 mr-1">0{slot.index}</span>
                          {slot.name}
                        </span>
                        <span className="text-[10px] font-mono-tech shrink-0 text-slate-400">
                          {!cfg.enabled ? 'OFF' : hasCustom ? 'SET' : 'EMPTY'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'crash' && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-400 mr-1">Crash Presets:</span>
                    {(
                      [
                        { id: 'intact', label: 'Intact' },
                        { id: 'scrape', label: 'Peel & Scrape' },
                        { id: 'wing-break', label: 'Broken Front Wing' },
                        { id: 'heavy', label: 'Heavy Crash' },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onChangeCrashState(getCrashPreset(p.id))}
                        className={`px-2.5 py-1 rounded border text-xs transition-colors whitespace-nowrap ${
                          p.id === 'intact' && crashState.decalPeel === 0 && crashState.frontWingBreak === 'none' && !crashState.suspensionBent
                            ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-300 font-medium'
                            : p.id === 'heavy' && crashState.frontWingBreak === 'both' && crashState.suspensionBent
                              ? 'border-red-400 bg-red-500/20 text-red-200 font-semibold'
                              : 'border-white/12 bg-white/5 text-slate-300 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 min-w-[200px]">
                    <label htmlFor="peel-slider" className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                      Decal Peel
                    </label>
                    <input
                      id="peel-slider"
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={crashState.decalPeel}
                      onChange={(e) =>
                        onChangeCrashState({ ...crashState, decalPeel: parseFloat(e.target.value) })
                      }
                      className="studio-slider flex-1"
                    />
                    <span className="font-mono-tech text-[11px] text-amber-400 w-9 text-right">
                      {Math.round(crashState.decalPeel * 100)}%
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/8">
                  <span className="text-[11px] text-slate-400 mr-1">Front Wing Break:</span>
                  {(['none', 'left', 'both'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onChangeCrashState({ ...crashState, frontWingBreak: mode })}
                      aria-pressed={crashState.frontWingBreak === mode}
                      className={`px-2 py-1 rounded border text-[11px] capitalize transition-colors ${
                        crashState.frontWingBreak === mode
                          ? 'border-red-400 bg-red-500/20 text-red-200 font-semibold'
                          : 'border-white/12 bg-white/5 text-slate-300 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}

                  <span className="text-white/15 mx-1">|</span>

                  <button
                    type="button"
                    onClick={() =>
                      onChangeCrashState({ ...crashState, suspensionBent: !crashState.suspensionBent })
                    }
                    aria-pressed={crashState.suspensionBent}
                    className={`px-2.5 py-1 rounded border text-[11px] transition-colors whitespace-nowrap ${
                      crashState.suspensionBent
                        ? 'border-red-400 bg-red-500/20 text-red-200 font-semibold'
                        : 'border-white/12 bg-white/5 text-slate-300 hover:text-white'
                    }`}
                  >
                    Bent Suspension
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onChangeCrashState({ ...crashState, rearWingDamaged: !crashState.rearWingDamaged })
                    }
                    aria-pressed={crashState.rearWingDamaged}
                    className={`px-2.5 py-1 rounded border text-[11px] transition-colors whitespace-nowrap ${
                      crashState.rearWingDamaged
                        ? 'border-red-400 bg-red-500/20 text-red-200 font-semibold'
                        : 'border-white/12 bg-white/5 text-slate-300 hover:text-white'
                    }`}
                  >
                    Damaged Rear Wing
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onChangeCrashState({ ...crashState, debrisVisible: !crashState.debrisVisible })
                    }
                    aria-pressed={crashState.debrisVisible}
                    className={`px-2.5 py-1 rounded border text-[11px] transition-colors whitespace-nowrap ${
                      crashState.debrisVisible
                        ? 'border-red-400 bg-red-500/20 text-red-200 font-semibold'
                        : 'border-white/12 bg-white/5 text-slate-300 hover:text-white'
                    }`}
                  >
                    3D Carbon Debris
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'camera' && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {CAMERA_PRESETS.map((preset) => {
                      const active = cameraPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onSelectCameraPreset(preset.id)}
                          aria-pressed={active}
                          className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'border-amber-500 bg-amber-500 text-slate-950 font-semibold'
                              : 'border-white/12 bg-white/5 text-slate-300 hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={onShowAllModules}
                      className="text-xs text-amber-400 hover:text-amber-300 font-medium"
                    >
                      Show All ({CHASSIS_MODULES.length - hiddenCount}/{CHASSIS_MODULES.length})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-white/8">
                  {CHASSIS_MODULES.map((mod) => {
                    const isHidden = !!hiddenModules[mod.id];
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => onToggleModule(mod.id)}
                        aria-pressed={!isHidden}
                        className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded border text-[11px] transition-colors text-left ${
                          isHidden
                            ? 'border-white/8 bg-black/30 text-slate-500'
                            : 'border-white/14 bg-white/6 text-slate-200 hover:border-white/25'
                        }`}
                      >
                        <span className="truncate">{mod.label}</span>
                        {isHidden ? (
                          <EyeOff className="w-3 h-3 shrink-0 text-slate-500" />
                        ) : (
                          <Eye className="w-3 h-3 shrink-0 text-amber-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
