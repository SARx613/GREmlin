// Assemble data/batches/*.json (rédigés par lots) en data/words.json avec les chapitres.
// Usage : npm run build-words
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const batchDir = path.join(root, 'data', 'batches');

type Raw = {
  pos: string;
  definition: string;
  definitionFr: string;
  sentences: string[];
  synonyms: string[];
  mnemonic?: string;
};

// Moyens mnémotechniques ajoutés après coup (utilisés si le lot n'en a pas)
const extraMnemonics: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'mnemonics.json'), 'utf8'),
);

const raw: Record<string, Raw> = {};
for (const f of fs.readdirSync(batchDir).filter((f) => f.endsWith('.json')).sort()) {
  Object.assign(raw, JSON.parse(fs.readFileSync(path.join(batchDir, f), 'utf8')));
}

const POS: Record<string, string> = { verb: 'v.', noun: 'n.', adjective: 'adj.', adverb: 'adv.' };
const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '-');

const words: Record<string, unknown> = {};
const order: string[] = [];
for (const [key, r] of Object.entries(raw)) {
  const id = slug(key);
  if (words[id]) continue; // dédoublonnage : première occurrence gardée
  order.push(id);
  words[id] = {
    id,
    word: key,
    pos: POS[r.pos] ?? r.pos,
    definition: r.definition.charAt(0).toLowerCase() + r.definition.slice(1),
    definitionFr: r.definitionFr,
    sentences: r.sentences,
    synonyms: r.synonyms,
    ...((r.mnemonic ?? extraMnemonics[key]) ? { mnemonic: r.mnemonic ?? extraMnemonics[key] } : {}),
  };
}

// Le fichier source a 3 sections.
// - Faux amis et Mots isolés : découpés en chapitres d'environ 25 mots, dans l'ordre.
// - Synonymes puissants : familles de sens (data/families.json) regroupées sans jamais couper une famille.
const sections = [
  { group: 'Faux amis', start: 'adept' },
  { group: 'Synonymes puissants', start: 'allay' },
  { group: 'Mots isolés', start: 'abet' },
];

type Chapter = { id: string; title: string; group: string; subtitle?: string; wordIds: string[] };
const chapters: Chapter[] = [];
const push = (group: string, n: number, wordIds: string[], subtitle?: string) =>
  chapters.push({
    id: `ch-${String(chapters.length + 1).padStart(2, '0')}`,
    title: `${group} ${n}`,
    group,
    ...(subtitle ? { subtitle } : {}),
    wordIds,
  });

const families: { label: string; words: string[] }[] = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'families.json'), 'utf8'),
);

sections.forEach((s, i) => {
  const from = order.indexOf(s.start);
  const to = i + 1 < sections.length ? order.indexOf(sections[i + 1].start) : order.length;
  if (from < 0 || to < 0) throw new Error(`Début de section introuvable : ${s.start}`);
  const ids = order.slice(from, to);

  if (s.group === 'Synonymes puissants') {
    // les familles doivent reprendre exactement les mots de la section, dans l'ordre
    const flat = families.flatMap((f) => f.words.map(slug));
    if (JSON.stringify(flat) !== JSON.stringify(ids)) {
      const bad = ids.find((id, k) => flat[k] !== id);
      throw new Error(`families.json ne correspond pas à la section (premier écart : ${bad})`);
    }
    let group: typeof families = [];
    let size = 0;
    let n = 0;
    const flush = () => {
      if (!group.length) return;
      push(s.group, ++n, group.flatMap((f) => f.words.map(slug)), group.map((f) => f.label).join(' · '));
      group = [];
      size = 0;
    };
    for (const f of families) {
      if (size > 0 && size + f.words.length > 30) flush();
      group.push(f);
      size += f.words.length;
      if (size >= 24) flush();
    }
    flush();
    return;
  }

  const n = Math.max(1, Math.round(ids.length / 25));
  const base = Math.floor(ids.length / n);
  const extra = ids.length % n;
  let pos = 0;
  for (let c = 0; c < n; c++) {
    const size = base + (c < extra ? 1 : 0);
    push(s.group, c + 1, ids.slice(pos, pos + size));
    pos += size;
  }
});

fs.writeFileSync(path.join(root, 'data', 'words.json'), JSON.stringify({ chapters, words }, null, 1) + '\n');
console.log(`words.json : ${order.length} mots, ${chapters.length} chapitres`);
