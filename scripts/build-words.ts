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
    ...(r.mnemonic ? { mnemonic: r.mnemonic } : {}),
  };
}

// Le fichier source a 3 sections ; chaque section est découpée en chapitres d'environ 25 mots.
const sections = [
  { group: 'Faux amis', start: 'adept' },
  { group: 'Synonymes puissants', start: 'allay' },
  { group: 'Mots isolés', start: 'abet' },
];

const chapters: { id: string; title: string; group: string; wordIds: string[] }[] = [];
sections.forEach((s, i) => {
  const from = order.indexOf(s.start);
  const to = i + 1 < sections.length ? order.indexOf(sections[i + 1].start) : order.length;
  if (from < 0 || to < 0) throw new Error(`Début de section introuvable : ${s.start}`);
  const ids = order.slice(from, to);
  const n = Math.max(1, Math.round(ids.length / 25));
  const base = Math.floor(ids.length / n);
  const extra = ids.length % n;
  let pos = 0;
  for (let c = 0; c < n; c++) {
    const size = base + (c < extra ? 1 : 0);
    chapters.push({
      id: `ch-${String(chapters.length + 1).padStart(2, '0')}`,
      title: `${s.group} ${c + 1}`,
      group: s.group,
      wordIds: ids.slice(pos, pos + size),
    });
    pos += size;
  }
});

fs.writeFileSync(path.join(root, 'data', 'words.json'), JSON.stringify({ chapters, words }, null, 1) + '\n');
console.log(`words.json : ${order.length} mots, ${chapters.length} chapitres`);
