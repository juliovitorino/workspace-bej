import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const locales = ['pt-BR', 'en-US', 'es-ES', 'fr-FR'];
export const outputRoot = path.resolve('migration-output/v4');
export const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
export const digest = value => createHash('sha256').update(value).digest('hex');
export const hashSet = values => digest([...new Set(values)].sort().join('\n'));
export const equalSets = (a, b) => a.size === b.size && [...a].every(value => b.has(value));
export const anchor = example => JSON.stringify([example.pt, example.ptIntent]);
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function write(file, value) {
  const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    const previous = fs.readFileSync(file);
    if (previous.equals(Buffer.from(content))) return;
    // Backups are retained deliverables, not temporary files.
    const backup = path.join(path.dirname(file), 'backups', `${path.basename(file)}.${digest(previous)}.bak`);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, previous);
  }
  fs.writeFileSync(file, content);
}
export function assigned(manifest, key, existing) {
  if (existing && !uuidPattern.test(existing)) throw new Error('Identificador existente fora do formato UUID; revisar sem substituir.');
  if (existing && manifest[key] && manifest[key] !== existing) throw new Error('Conflito no manifesto de identificadores.');
  return manifest[key] ??= existing ?? randomUUID();
}
export function migrateIntention(item, locale, resolveId) {
  const { english, englishLevel, examples, ...rest } = item;
  if (rest.structure !== undefined && rest.structure !== english) throw new Error('Conflito entre english e structure.');
  if (rest.level !== undefined && rest.level !== englishLevel) throw new Error('Conflito entre englishLevel e level.');
  return { ...rest, structure: english, level: englishLevel, examples: examples.map((example, index) => {
    const { pt, en, ptIntent, enIntent, ...extra } = example;
    // Media and unknown attributes stay in their original locale only.
    return { ...extra, id: resolveId(example, index), exampleItem: locale === 'pt-BR' ? pt : en,
      intent: locale === 'pt-BR' ? ptIntent : enIntent };
  }) };
}
