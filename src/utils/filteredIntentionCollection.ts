import type { HashmapIntentionV4 } from "../types/hashmap";

/**
 * Seleciona os registros originais do catálogo V4 pela ordem do filtro.
 * Mantém cada objeto inteiro, inclusive atributos opcionais/desconhecidos,
 * sem reconstruir os dados a partir do modelo normalizado da interface.
 */
export function selectOriginalIntentions(
  catalog: HashmapIntentionV4[],
  filteredIds: string[]
): HashmapIntentionV4[] {
  const byId = new Map(catalog.map(item => [item.id, item]));
  return filteredIds.map(id => {
    const original = byId.get(id);
    if (!original) throw new Error(`Intenção não encontrada no catálogo original: ${id}`);
    return original;
  });
}
