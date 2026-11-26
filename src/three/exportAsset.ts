import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export function exportObjectToGLB(
  object: THREE.Object3D,
  filename = 'f1-2026-chassis.glb',
): Promise<number> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      object,
      (result) => {
        if (result instanceof ArrayBuffer) {
          const blob = new Blob([result], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          resolve(result.byteLength);
        } else {
          const json = JSON.stringify(result, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename.replace(/\.glb$/, '.gltf');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          resolve(blob.size);
        }
      },
      (err) => reject(err),
      { binary: true },
    );
  });
}
