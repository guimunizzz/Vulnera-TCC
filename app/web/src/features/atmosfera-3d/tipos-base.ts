/**
 * features/atmosfera-3d/tipos-base.ts
 *
 * Os tipos das atmosferas que o bundle principal também usa. Ficam fora de
 * `tipos.ts` porque aquele referencia tipos de three, e o lint barra three
 * (até `import type`) fora dos módulos lazy.
 */

export type TemaDaVariante = "dark" | "light";

/**
 * plataforma = atrás do conteúdo do produto: calma, sem bloom, mais leve.
 * imersivo   = intensidade cheia, bloom e clique que pinga (modo apresentação).
 */
export type ModoDaVariante = "plataforma" | "imersivo";
