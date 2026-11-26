import { useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';
import {
  AssetLodTier,
  CHASSIS_MODULES,
  F1_2026_DIMENSIONS,
  LiveryId,
  TireCompoundId,
  generateGameIntegrationSnippet,
  generateGltfCompressCliCommand,
} from '../three/f1Chassis2026Spec';
import { AssetMeshStats } from '../three/createF1Car2026';

interface AssetCodeModalProps {
  open: boolean;
  onClose: () => void;
  livery: LiveryId;
  tireCompound: TireCompoundId;
  lod: AssetLodTier;
  stats: AssetMeshStats | null;
  onExportGLB: () => void;
  exporting: boolean;
}

export function AssetCodeModal({
  open,
  onClose,
  livery,
  tireCompound,
  lod,
  stats,
  onExportGLB,
  exporting,
}: AssetCodeModalProps) {
  const [copiedTarget, setCopiedTarget] = useState<'code' | 'cli' | null>(null);
  const [modalTab, setModalTab] = useState<'integration' | 'compression'>('compression');

  if (!open) return null;

  const snippet = generateGameIntegrationSnippet(livery, tireCompound, lod);
  const cliCommand = generateGltfCompressCliCommand(livery);

  const handleCopy = async (text: string, target: 'code' | 'cli') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 1800);
    } catch {
      // Clipboard may be restricted in non-HTTPS contexts
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="w-full max-w-2xl rounded-xl border border-white/15 bg-[#10141e] text-slate-100 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 id="asset-modal-title" className="font-display text-lg font-semibold text-white">
              WebGL & Three.js Game Optimization Guide
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              glTF 2.0 (.glb) · 1 unit = 1m · +Z forward · Y = 0.000 ground contact
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Computed Geometry Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
              <div className="text-[11px] text-slate-400">Triangles ({lod === 'game-low' ? 'Low-Poly' : 'High'})</div>
              <div className="font-mono-tech text-base font-semibold text-amber-400 mt-0.5">
                {stats ? stats.triangles.toLocaleString() : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
              <div className="text-[11px] text-slate-400">Meshes</div>
              <div className="font-mono-tech text-base font-semibold text-white mt-0.5">
                {stats ? stats.meshes : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
              <div className="text-[11px] text-slate-400">Wheelbase</div>
              <div className="font-mono-tech text-base font-semibold text-white mt-0.5">
                {F1_2026_DIMENSIONS.wheelbase.toFixed(2)} m
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
              <div className="text-[11px] text-slate-400">Max Width</div>
              <div className="font-mono-tech text-base font-semibold text-white mt-0.5">
                {F1_2026_DIMENSIONS.maxWidth.toFixed(2)} m
              </div>
            </div>
          </div>

          {/* Modal Navigation Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-black/40 border border-white/10 w-fit">
            <button
              type="button"
              onClick={() => setModalTab('compression')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                modalTab === 'compression'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Kompresi Tekstur & WebGL
            </button>
            <button
              type="button"
              onClick={() => setModalTab('integration')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                modalTab === 'integration'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Three.js Loader & Node
            </button>
          </div>

          {modalTab === 'compression' ? (
            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <div className="rounded-lg border border-white/10 bg-black/25 p-3.5 space-y-2">
                <h3 className="font-semibold text-white">
                  1. Format Model: GLB (glTF 2.0 Binary) + Meshopt / Draco
                </h3>
                <p className="text-slate-400">
                  Ekspor aset dengan mode <span className="text-amber-300 font-medium">Game Low-Poly</span> ({stats?.triangles.toLocaleString()} tris).
                  Kompresi <span className="text-white font-medium">Meshopt</span> atau <span className="text-white font-medium">Draco</span> mengecilkan ukuran file `.glb` hingga 70–85% tanpa mengubah bentuk aerodinamika 2026.
                </p>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/25 p-3.5 space-y-2">
                <h3 className="font-semibold text-white">
                  2. Kompresi Tekstur GPU: KTX2 (Basis Universal) / WebP
                </h3>
                <ul className="list-disc pl-4 space-y-1 text-slate-400">
                  <li>
                    <span className="text-white font-medium">KTX2 (ETC1S / UASTC):</span> Tetap terkompresi langsung di VRAM GPU (hemat RAM 4–6x dibanding PNG/JPG dan bebas stutter saat upload ke WebGL). Gunakan <code className="text-amber-300">ETC1S</code> untuk Albedo/Carbon Weave dan <code className="text-amber-300">UASTC</code> untuk Normal/Bump Map.
                  </li>
                  <li>
                    <span className="text-white font-medium">Resolusi Efisien:</span> Batasi tekstur karbon & ban ke <code className="text-amber-300">512×512</code> atau <code className="text-amber-300">256×256</code> (tileable repeat) + mipmapping + <code className="text-amber-300">anisotropy = 4</code> agar tajam di sudut rendah lintasan.
                  </li>
                  <li>
                    <span className="text-white font-medium">Color Space:</span> Pastikan Albedo/Sidewall memakai <code className="text-amber-300">SRGBColorSpace</code>, sedangkan Bump/Roughness/Normal tetap linear (<code className="text-amber-300">NoColorSpace</code>).
                  </li>
                </ul>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-slate-300">
                    CLI Pipeline (gltf-transform) setelah download .GLB:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(cliCommand, 'cli')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/15 bg-white/5 text-xs text-slate-200 hover:bg-white/10 transition-colors"
                  >
                    {copiedTarget === 'cli' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy CLI</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="rounded-lg border border-white/10 bg-[#090b10] p-3 text-[11px] font-mono-tech text-slate-200 overflow-x-auto">
                  <code>{cliCommand}</code>
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Node Hierarchy List */}
              <div>
                <div className="text-xs font-medium text-slate-300 mb-2">
                  Exported Scene Graph Sub-Assemblies ({CHASSIS_MODULES.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {CHASSIS_MODULES.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between px-3 py-1.5 rounded border border-white/8 bg-black/25"
                    >
                      <span className="font-mono-tech text-amber-300">{m.id}</span>
                      <span className="text-slate-400 truncate ml-2">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Three.js Prefab Code Snippet */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-300">
                    Three.js GLTFLoader + DRACOLoader + KTX2Loader
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(snippet, 'code')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/15 bg-white/5 text-xs text-slate-200 hover:bg-white/10 transition-colors"
                  >
                    {copiedTarget === 'code' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="rounded-lg border border-white/10 bg-[#090b10] p-3.5 text-[11px] font-mono-tech text-slate-200 overflow-x-auto leading-relaxed">
                  <code>{snippet}</code>
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-white/10 bg-black/25">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-white/15 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onExportGLB}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Exporting GLB...' : `Download ${lod === 'game-low' ? 'Low-Poly' : 'High'} .GLB`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
