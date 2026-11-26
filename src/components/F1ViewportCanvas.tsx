import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  AeroMode,
  AssetLodTier,
  CameraPresetId,
  ChassisModuleId,
  LiveryId,
  TireCompoundId,
  getCameraPreset,
} from '../three/f1Chassis2026Spec';
import {
  AssetMeshStats,
  F1Car2026Asset,
  createF1Car2026,
} from '../three/createF1Car2026';
import { CrashEffectState } from '../three/f1Decals';
import {
  F1AppearanceConfig,
  createContactShadowTexture,
  createStudioFloorTexture,
} from '../three/f1Materials';
import { TelemetryOverlay } from './TelemetryOverlay';

export interface F1ViewportProps {
  livery: LiveryId;
  appearance: F1AppearanceConfig;
  crashState: CrashEffectState;
  tireCompound: TireCompoundId;
  aeroMode: AeroMode;
  lod: AssetLodTier;
  explodeFactor: number;
  speedKmh: number;
  steerNormalized: number;
  cameraPreset: CameraPresetId;
  cameraPresetTrigger: number;
  autoRotate: boolean;
  hiddenModules: Record<ChassisModuleId, boolean>;
  onStatsReady: (stats: AssetMeshStats) => void;
  onRegisterExporter: (fn: () => THREE.Group | null) => void;
}

const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function F1ViewportCanvas({
  livery,
  appearance,
  crashState,
  tireCompound,
  aeroMode,
  lod,
  explodeFactor,
  speedKmh,
  steerNormalized,
  cameraPreset,
  cameraPresetTrigger,
  autoRotate,
  hiddenModules,
  onStatsReady,
  onRegisterExporter,
}: F1ViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const maxAnisoRef = useRef<number>(4);
  const carRef = useRef<F1Car2026Asset | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const cameraTransitionRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
    fov: number;
  }>({
    active: false,
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 38,
  });

  const liveStateRef = useRef({
    speedKmh,
    steerNormalized,
    autoRotate,
    explodeFactor,
    aeroMode,
    livery,
    appearance,
    crashState,
    tireCompound,
    lod,
    hiddenModules,
  });

  liveStateRef.current = {
    speedKmh,
    steerNormalized,
    autoRotate,
    explodeFactor,
    aeroMode,
    livery,
    appearance,
    crashState,
    tireCompound,
    lod,
    hiddenModules,
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const bgColor = new THREE.Color('#0c0f16');
    scene.background = bgColor;
    scene.fog = new THREE.FogExp2(0x0c0f16, 0.036);

    const initialCam = getCameraPreset('hero');
    const camera = new THREE.PerspectiveCamera(initialCam.fov, width / height, 0.1, 80);
    camera.position.set(...initialCam.position);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    // Studio Reflection Environment (RoomEnvironment on all devices)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Warm/Cool 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x9bb8eb, 0x161922, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.55);
    keyLight.position.set(4.5, 6.2, 4.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 16;
    const d = 3.6;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xbcd6ff, 1.35);
    rimLight.position.set(-4.8, 3.2, -4.5);
    scene.add(rimLight);

    // Overhead Softboxes (skip on software WebGL for fast frame times)
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softboxTop = new THREE.RectAreaLight(0xffffff, 2.6, 5.2, 1.3);
      softboxTop.position.set(0, 3.6, 0.2);
      softboxTop.lookAt(0, 0.3, 0.2);
      scene.add(softboxTop);

      const softboxSide = new THREE.RectAreaLight(0xffe7c2, 1.4, 4.2, 0.9);
      softboxSide.position.set(3.4, 1.6, 0);
      softboxSide.lookAt(0, 0.4, 0);
      scene.add(softboxSide);
    }

    // Studio Turntable Floor + Contact Shadow Grounding
    const maxAniso = isSoftwareGl ? 1 : Math.min(8, renderer.capabilities.getMaxAnisotropy());
    maxAnisoRef.current = maxAniso;
    const floorTex = createStudioFloorTexture(maxAniso);
    const floorGeo = new THREE.CircleGeometry(18, 64);
    floorGeo.rotateX(-Math.PI * 0.5);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: floorTex,
      roughness: 0.72,
      metalness: 0.14,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(2.65, 5.75);
    shadowGeo.rotateX(-Math.PI * 0.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.position.set(0, 0.008, 0.12);
    scene.add(contactShadow);

    // Build 2026 F1 Chassis Asset
    const f1Asset = createF1Car2026({
      livery,
      tireCompound,
      aeroMode,
      lod,
      maxAnisotropy: maxAniso,
      appearance,
      crashState,
    });
    scene.add(f1Asset.group);
    carRef.current = f1Asset;
    onStatsReady(f1Asset.getStats());
    onRegisterExporter(() => carRef.current?.group ?? null);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...initialCam.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.065;
    controls.minDistance = 1.6;
    controls.maxDistance = 10.5;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.minPolarAngle = 0.08;
    controls.update();

    controls.addEventListener('start', () => {
      cameraTransitionRef.current.active = false;
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Smart Render Loop + Software-WebGL afterDraw Pacing
    let frameId = 0;
    let disposed = false;
    let renderBusy = false;
    let renderDirty = false;
    let settleFrames = 24; // run briefly after interactions to finish damping
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function stepAndRender() {
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const { speedKmh: spd, steerNormalized: steer, autoRotate: rot } = liveStateRef.current;

      // Update F1 kinematics (wheels, steering, active aero damping, explode damping)
      carRef.current?.updateAnimation(dt, spd, steer);

      // Update camera preset glide
      if (cameraTransitionRef.current.active) {
        _camTargetPos.copy(cameraTransitionRef.current.pos);
        _camTargetLook.copy(cameraTransitionRef.current.target);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, 7, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, 7, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 7, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _camTargetLook.x, 7, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _camTargetLook.y, 7, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _camTargetLook.z, 7, dt);
        if (Math.abs(camera.fov - cameraTransitionRef.current.fov) > 0.05) {
          camera.fov = THREE.MathUtils.damp(camera.fov, cameraTransitionRef.current.fov, 7, dt);
          camera.updateProjectionMatrix();
        }
        if (
          camera.position.distanceTo(_camTargetPos) < 0.015 &&
          controls.target.distanceTo(_camTargetLook) < 0.015
        ) {
          cameraTransitionRef.current.active = false;
        }
      }

      controls.autoRotate = rot;
      controls.autoRotateSpeed = 1.4;
      controls.update();

      renderer.render(scene, camera);
    }

    function needsContinuousFrame(): boolean {
      const { speedKmh: spd, autoRotate: rot } = liveStateRef.current;
      return (
        spd > 0.5 ||
        rot ||
        cameraTransitionRef.current.active ||
        settleFrames > 0
      );
    }

    function scheduleNext() {
      if (disposed) return;
      if (needsContinuousFrame()) {
        if (settleFrames > 0) settleFrames -= 1;
        if (isSoftwareGl) {
          afterDraw(() => {
            if (!disposed) {
              stepAndRender();
              scheduleNext();
            }
          });
        } else {
          frameId = requestAnimationFrame(() => {
            if (!disposed) {
              stepAndRender();
              scheduleNext();
            }
          });
        }
      } else {
        renderBusy = false;
        if (renderDirty) {
          renderDirty = false;
          requestRender();
        }
      }
    }

    function requestRender(extraSettle = 18) {
      settleFrames = Math.max(settleFrames, extraSettle);
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      lastTime = performance.now();
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        stepAndRender();
        if (isSoftwareGl) {
          afterDraw(scheduleNext);
        } else {
          scheduleNext();
        }
      });
    }

    requestRenderRef.current = () => requestRender(28);
    controls.addEventListener('change', () => requestRender(10));

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender(4);
    };
    window.addEventListener('resize', handleResize);

    // Initial render
    requestRender(8);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      carRef.current?.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      floorTex.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      carRef.current = null;
      sceneRef.current = null;
      onRegisterExporter(() => null);
    };
  }, []);

  // Rebuild only the car mesh when LOD tier switches
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !carRef.current) return;
    const oldCar = carRef.current;
    const state = liveStateRef.current;

    const newCar = createF1Car2026({
      livery: state.livery,
      tireCompound: state.tireCompound,
      aeroMode: state.aeroMode,
      lod,
      maxAnisotropy: maxAnisoRef.current,
      appearance: state.appearance,
      crashState: state.crashState,
    });
    newCar.setExplodeFactor(state.explodeFactor);
    (Object.keys(state.hiddenModules) as ChassisModuleId[]).forEach((id) => {
      newCar.setModuleVisibility(id, !state.hiddenModules[id]);
    });

    scene.remove(oldCar.group);
    oldCar.dispose();
    scene.add(newCar.group);
    carRef.current = newCar;
    onStatsReady(newCar.getStats());
    requestRenderRef.current();
  }, [lod]);

  // Sync React controls to live 3D asset without re-mounting WebGLRenderer
  useEffect(() => {
    carRef.current?.setAppearance(appearance, () => requestRenderRef.current());
    requestRenderRef.current();
  }, [appearance]);

  useEffect(() => {
    carRef.current?.setCrashState(crashState);
    requestRenderRef.current();
  }, [crashState]);

  useEffect(() => {
    carRef.current?.setTireCompound(tireCompound);
    requestRenderRef.current();
  }, [tireCompound]);

  useEffect(() => {
    carRef.current?.setAeroMode(aeroMode);
    requestRenderRef.current();
  }, [aeroMode]);

  useEffect(() => {
    carRef.current?.setExplodeFactor(explodeFactor);
    requestRenderRef.current();
  }, [explodeFactor]);

  useEffect(() => {
    (Object.keys(hiddenModules) as ChassisModuleId[]).forEach((id) => {
      carRef.current?.setModuleVisibility(id, !hiddenModules[id]);
    });
    requestRenderRef.current();
  }, [hiddenModules]);

  useEffect(() => {
    requestRenderRef.current();
  }, [speedKmh, steerNormalized, autoRotate]);

  useEffect(() => {
    if (cameraPresetTrigger === 0) return;
    const preset = getCameraPreset(cameraPreset);
    cameraTransitionRef.current.pos.set(...preset.position);
    cameraTransitionRef.current.target.set(...preset.target);
    cameraTransitionRef.current.fov = preset.fov;
    cameraTransitionRef.current.active = true;
    requestRenderRef.current();
  }, [cameraPreset, cameraPresetTrigger]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mountRef}
        data-testid="f1-3d-canvas-container"
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
      <TelemetryOverlay aeroMode={aeroMode} speedKmh={speedKmh} />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0c0f16] text-slate-200">
          <div className="text-center space-y-2 px-6">
            <p className="font-display text-lg font-semibold">WebGL Context Interrupted</p>
            <p className="text-sm text-slate-400">
              Restoring hardware 3D viewport for the 2026 F1 chassis model.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
