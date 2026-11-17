/**
 * three/dispose.ts
 *
 * O QUE FAZ
 * Percorre uma ou mais cenas e libera geometrias, materiais e texturas.
 *
 * POR QUE EXISTE
 * three.js não libera memória de GPU sozinho: sem `dispose()`, cada navegação
 * que monta e desmonta uma cena vaza buffers. Percorrer a cena em vez de manter
 * uma lista à mão garante que um objeto novo, adicionado depois, também seja
 * liberado. Geometria e material compartilhados entram num `Set` e são
 * descartados uma vez só.
 *
 * Limite: objetos que nunca foram adicionados à cena (ex.: a geometria-base de
 * um `EdgesGeometry`) não são alcançados — quem os cria os descarta.
 *
 * QUEM USA
 * Os hooks de cena (hoje `use-dashboard-scene.ts`).
 */

import * as THREE from "three";

function texturasDe(material: THREE.Material): THREE.Texture[] {
  const valores: unknown[] = Object.values(material);
  if (material instanceof THREE.ShaderMaterial) {
    valores.push(...Object.values(material.uniforms).map((uniforme) => uniforme.value));
  }
  return valores.filter((valor): valor is THREE.Texture => valor instanceof THREE.Texture);
}

export function descartarCena(...raizes: THREE.Object3D[]): void {
  const geometrias = new Set<THREE.BufferGeometry>();
  const materiais = new Set<THREE.Material>();

  for (const raiz of raizes) {
    raiz.traverse((objeto) => {
      const { geometry, material } = objeto as Partial<THREE.Mesh>;
      if (geometry) geometrias.add(geometry);
      if (material) (Array.isArray(material) ? material : [material]).forEach((m) => materiais.add(m));
    });
  }

  for (const material of materiais) {
    texturasDe(material).forEach((textura) => textura.dispose());
    material.dispose();
  }
  geometrias.forEach((geometria) => geometria.dispose());
}
