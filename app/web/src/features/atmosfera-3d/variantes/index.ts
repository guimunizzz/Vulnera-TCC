import type { FabricaDeVariante } from "../tipos";
import { criarNebulosa } from "./nebulosa";
import { criarRelevo } from "./relevo";

export interface ItemDoCatalogo {
  id: string;
  nome: string;
  descricao: string;
  fabrica: FabricaDeVariante;
}

export const CATALOGO_3D: ItemDoCatalogo[] = [
  {
    id: "relevo",
    nome: "Relevo",
    descricao: "Voo baixo sobre curvas de nível varridas por um radar; cada alvo detectado solta um ping. O ponteiro levanta um morro.",
    fabrica: criarRelevo,
  },
  {
    id: "nebulosa",
    nome: "Nebulosa",
    descricao: "Galáxia espiral em rotação diferencial, varrida por um radar que acende as estrelas e pinga alvos. O ponteiro abre um redemoinho.",
    fabrica: criarNebulosa,
  },
];
