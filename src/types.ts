export type Word = {
  id: string;
  word: string;
  pos: string;
  definition: string;
  definitionFr: string;
  sentences: string[];
  synonyms: string[];
  mnemonic?: string;
};

export type Chapter = {
  id: string;
  title: string;
  group: string;
  subtitle?: string; // familles de sens du chapitre (synonymes)
  wordIds: string[];
};

export type WordsData = {
  chapters: Chapter[];
  words: Record<string, Word>;
};

export type WordProgress = {
  box: number; // 0 = nouveau, 1..5 = en apprentissage, 6 = maîtrisé
  dueAt: number; // timestamp ms ; 0 pour un mot jamais vu
  seen: number;
  misses: number;
  known?: boolean; // true = « je connais », false = « je ne connais pas » (prioritaire)
};

export type Streak = { count: number; lastDay: string | null; best?: number };

/** Bilan d'une journée : leçons terminées et mots maîtrisés en fin de journée (pour les statistiques). */
export type DayStat = { lessons: number; mastered: number };

export type Progress = {
  words: Record<string, WordProgress>;
  streak: Streak;
  sound: boolean;
  days?: Record<string, DayStat>;
  starred?: string[]; // mots favoris
  blitz?: { best: number; plays: number };
};

export type ChoiceType = 'wordToDef' | 'defToWord' | 'fillBlank' | 'synonym' | 'listen';
export type ExerciseType = ChoiceType | 'equivalence' | 'typeWord' | 'dictation' | 'pairs';

export type Choice = { id: string; label: string };

export type ChoiceExercise = {
  kind: 'choice';
  type: ChoiceType;
  wordId: string;
  prompt: string;
  sentence?: string; // phrase complète (pour le feedback)
  options: Choice[];
  answerId: string;
  retry?: boolean;
};

/** Sentence Equivalence (GRE) : une phrase, 6 mots, 2 réponses qui donnent le même sens. */
export type MultiExercise = {
  kind: 'multi';
  type: 'equivalence';
  wordId: string;
  prompt: string;
  sentence: string;
  options: Choice[];
  answerIds: string[];
  retry?: boolean;
};

/** Écrire le mot : à partir de sa définition (typeWord) ou en l'entendant (dictation). */
export type TypeExercise = {
  kind: 'type';
  type: 'typeWord' | 'dictation';
  wordId: string;
  prompt: string;
  hint: string;
  retry?: boolean;
};

export type PairsExercise = {
  kind: 'pairs';
  type: 'pairs';
  wordIds: string[]; // ordre d'affichage à gauche
  defs: { wordId: string; text: string }[]; // ordre d'affichage à droite
};

export type SingleExercise = ChoiceExercise | MultiExercise | TypeExercise;
export type Exercise = SingleExercise | PairsExercise;

export type QueueItem = { kind: 'intro'; wordId: string } | { kind: 'ex'; exercise: Exercise };

export type LessonMode = 'chapter' | 'selection' | 'review' | 'free';

export type LessonConfig = {
  mode: LessonMode;
  chapterId?: string;
  wordIds?: string[]; // mode « selection »
};

export type LessonState = {
  queue: QueueItem[];
  total: number; // nombre initial d'exercices (intros exclues)
  done: number; // exercices réussis (ne recule jamais)
  firstTry: number; // exercices réussis du premier coup
  errors: Record<string, number>; // erreurs par mot
  wordIds: string[]; // mots de la leçon
};

export type LessonSnapshot = { config: LessonConfig; state: LessonState; applySrs: boolean };
