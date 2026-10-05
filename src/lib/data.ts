import raw from '../../data/words.json';
import type { WordsData } from '../types';

export const data = raw as WordsData;

export const chapterById = (id: string) => data.chapters.find((c) => c.id === id);
