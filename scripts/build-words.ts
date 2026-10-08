// Assemble data/batches/*.json (01.json à 16.json) en data/words.json avec découpage en chapitres équilibrés.
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

// Moyens mnémotechniques optionnels ajoutés
let extraMnemonics: Record<string, string> = {};
const mnemonicsPath = path.join(root, 'data', 'mnemonics.json');
if (fs.existsSync(mnemonicsPath)) {
  try {
    extraMnemonics = JSON.parse(fs.readFileSync(mnemonicsPath, 'utf8'));
  } catch {
    /* ignore */
  }
}

const POS: Record<string, string> = {
  verb: 'v.',
  v: 'v.',
  noun: 'n.',
  n: 'n.',
  adjective: 'adj.',
  adj: 'adj.',
  adverb: 'adv.',
  adv: 'adv.',
};

const slug = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const raw: Record<string, Raw> = {};
for (const f of fs.readdirSync(batchDir).filter((f) => f.endsWith('.json')).sort()) {
  const content = JSON.parse(fs.readFileSync(path.join(batchDir, f), 'utf8'));
  Object.assign(raw, content);
}

const words: Record<string, unknown> = {};
const allSlugs: string[] = [];

for (const [key, r] of Object.entries(raw)) {
  const id = slug(key);
  if (words[id]) continue; // dédoublonnage strict

  const normPos = POS[r.pos.replace('.', '')] ?? r.pos;
  const def = r.definition ? r.definition.charAt(0).toLowerCase() + r.definition.slice(1) : '';

  allSlugs.push(id);
  words[id] = {
    id,
    word: key,
    pos: normPos,
    definition: def,
    definitionFr: r.definitionFr,
    sentences: r.sentences,
    synonyms: r.synonyms,
    ...((r.mnemonic ?? extraMnemonics[key]) ? { mnemonic: r.mnemonic ?? extraMnemonics[key] } : {}),
  };
}

// Mélange pseudo-aléatoire déterministe (Mulberry32 PRNG avec graine fixe) pour un mix équilibré et reproductible
function seededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = seededRandom(42);
const shuffled = [...allSlugs];
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(rng() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}

// Découpage en chapitres d'environ 25 mots (1134 mots -> 45 chapitres)
const WORDS_PER_CHAPTER = 25;
const numChapters = Math.ceil(shuffled.length / WORDS_PER_CHAPTER);

type Chapter = { id: string; title: string; group: string; subtitle?: string; wordIds: string[] };
const chapters: Chapter[] = [];

const SERIES_NAMES = [
  'Série 1 · Fondations & Essentiels',
  'Série 2 · Précision & Nuances',
  'Série 3 · Vocabulaire académique',
  'Série 4 · Maîtrise GRE',
  'Série 5 · Perfectionnement & Élite',
];

const chaptersPerSeries = Math.ceil(numChapters / SERIES_NAMES.length);

for (let c = 0; c < numChapters; c++) {
  const chNum = c + 1;
  const start = c * WORDS_PER_CHAPTER;
  const end = Math.min(shuffled.length, (c + 1) * WORDS_PER_CHAPTER);
  const wordIds = shuffled.slice(start, end);

  const seriesIndex = Math.min(SERIES_NAMES.length - 1, Math.floor(c / chaptersPerSeries));
  const group = SERIES_NAMES[seriesIndex];

  chapters.push({
    id: `ch-${String(chNum).padStart(2, '0')}`,
    title: `Chapitre ${chNum}`,
    group,
    subtitle: `${wordIds.length} mots`,
    wordIds,
  });
}

const outPath = path.join(root, 'data', 'words.json');
fs.writeFileSync(outPath, JSON.stringify({ chapters, words }, null, 2) + '\n');

console.log(`✓ words.json généré avec succès :`);
console.log(`  - ${Object.keys(words).length} mots uniques`);
console.log(`  - ${chapters.length} chapitres répartis en ${SERIES_NAMES.length} séries`);
