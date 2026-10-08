// Vérifie data/words.json. Usage : npm run validate
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findForm } from '../src/lib/match';
import type { WordsData } from '../src/types';

const defaultFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'words.json');
const file = process.argv[2] ? path.resolve(process.argv[2]) : defaultFile;
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors: string[] = [];
const err = (id: string, msg: string) => errors.push(`${id} : ${msg}`);

if (data.chapters && data.words) {
  const inChapter = new Set<string>();
  for (const ch of data.chapters) {
    if (ch.wordIds.length < 4) err(ch.id, `seulement ${ch.wordIds.length} mots (minimum 4)`);
    for (const id of ch.wordIds) {
      if (!data.words[id]) err(ch.id, `wordId inconnu « ${id} »`);
      if (inChapter.has(id)) err(ch.id, `mot « ${id} » présent dans plusieurs chapitres`);
      inChapter.add(id);
    }
  }

  for (const w of Object.values<any>(data.words)) {
    if (!inChapter.has(w.id)) err(w.id, 'dans aucun chapitre');
    for (const f of ['word', 'pos', 'definition', 'definitionFr'] as const) {
      if (!w[f]?.trim()) err(w.id, `champ « ${f} » vide`);
    }
    if (w.definition && w.definition.split(/\s+/).length > 15) err(w.id, 'définition > 15 mots');
    if (!Array.isArray(w.sentences) || w.sentences.length !== 2) err(w.id, 'il faut exactement 2 phrases');
    else {
      for (const s of w.sentences) {
        const n = s.trim().split(/\s+/).length;
        if (n < 15 || n > 32) err(w.id, `phrase de ${n} mots : « ${s.slice(0, 40)}… »`);
        if (!findForm(s, w.word)) err(w.id, `le mot n'apparaît pas dans : « ${s} »`);
      }
    }
    if (!Array.isArray(w.synonyms) || w.synonyms.length < 2 || w.synonyms.length > 4) err(w.id, 'il faut 2 à 4 synonymes');
  }

  if (errors.length) {
    console.error(`${errors.length} problème(s) :\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`OK : ${Object.keys(data.words).length} mots, ${data.chapters.length} chapitres`);
} else {
  for (const [key, w] of Object.entries<any>(data)) {
    for (const f of ['pos', 'definition', 'definitionFr'] as const) {
      if (!w[f]?.trim()) err(key, `champ « ${f} » vide`);
    }
    if (w.definition && w.definition.trim().split(/\s+/).length > 15) err(key, 'définition > 15 mots');
    if (!Array.isArray(w.sentences) || w.sentences.length !== 2) err(key, 'il faut exactement 2 phrases');
    else {
      for (const s of w.sentences) {
        const n = s.trim().split(/\s+/).length;
        if (n < 18 || n > 30) err(key, `phrase de ${n} mots : « ${s.slice(0, 40)}… »`);
        if (!findForm(s, key)) err(key, `le mot n'apparaît pas dans : « ${s} »`);
      }
    }
    if (!Array.isArray(w.synonyms) || w.synonyms.length < 2 || w.synonyms.length > 4) err(key, 'il faut 2 à 4 synonymes');
    else {
      if (w.synonyms.some((syn: string) => syn.toLowerCase() === key.toLowerCase())) err(key, 'le mot ne peut pas être son propre synonyme');
    }
  }

  if (errors.length) {
    console.error(`${errors.length} problème(s) :\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  console.log('OK : tout est valide');
}

