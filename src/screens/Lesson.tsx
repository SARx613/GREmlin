import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import Button from '../components/Button';
import FeedbackBar from '../components/FeedbackBar';
import Intro from '../components/exercises/Intro';
import MatchPairs from '../components/exercises/MatchPairs';
import MultipleChoice from '../components/exercises/MultipleChoice';
import SentenceEquivalence from '../components/exercises/SentenceEquivalence';
import TypeWord from '../components/exercises/TypeWord';
import Modal from '../components/Modal';
import ProgressBar from '../components/ProgressBar';
import { Sentence } from '../components/WordCard';
import { MULTI_SEP, alternativeFor, grade, type Grade } from '../lib/exercises';
import { data } from '../lib/data';
import { canSpeak, speak } from '../lib/speak';
import { clearLesson, saveLesson } from '../lib/storage';
import { advanceIntro, isFinished, progressRatio, resolveExercise, resolvePairs } from '../lib/session';
import { getWP } from '../lib/srs';
import type { Exercise, LessonSnapshot, LessonState, Progress } from '../types';

type Checked = { grade: Grade; wrongPairs?: string[] };

type Props = {
  snapshot: LessonSnapshot;
  progress: Progress;
  onExit: () => void;
  onFinish: (state: LessonState) => void;
};

export default function Lesson({ snapshot, progress, onExit, onFinish }: Props) {
  const [state, setState] = useState(snapshot.state);
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState<Checked | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const listening = progress.sound && canSpeak();

  const item = state.queue[0];
  const exercise: Exercise | null = item?.kind === 'ex' ? item.exercise : null;
  const introWord = item?.kind === 'intro' ? data.words[item.wordId] : null;

  // l'intro prononce le mot à son apparition
  useEffect(() => {
    if (introWord && progress.sound) speak(introWord.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introWord?.id]);

  function commit(next: LessonState) {
    setState(next);
    setValue('');
    setChecked(null);
    if (isFinished(next)) onFinish(next);
    else saveLesson({ ...snapshot, state: next }); // survit à un rechargement
  }

  // « Vérifier » exige une réponse ; la Sentence Equivalence en demande exactement deux
  const canCheck = exercise?.kind === 'multi' ? value.split(MULTI_SEP).filter(Boolean).length === 2 : !!value.trim();

  function check() {
    if (!exercise || exercise.kind === 'pairs' || checked || !canCheck) return;
    const g = grade(exercise, data, value);
    setChecked({ grade: g });
    if (g !== 'wrong' && progress.sound) speak(data.words[exercise.wordId].word);
  }

  function next() {
    if (introWord) return commit(advanceIntro(state));
    if (!exercise || !checked) return;
    if (exercise.kind === 'pairs') return commit(resolvePairs(state, checked.wrongPairs ?? []));
    const ok = checked.grade !== 'wrong';
    const box = getWP(progress.words, exercise.wordId).box;
    commit(resolveExercise(state, ok, ok ? undefined : alternativeFor(data, exercise, box, Math.random, listening)));
  }

  // clavier : 1-4 choisit, Entrée vérifie / continue
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmQuit) return;
      const inField = e.target instanceof HTMLInputElement;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (introWord || checked) next();
        else check();
      } else if (!inField && !checked && exercise?.kind === 'choice' && /^[1-4]$/.test(e.key)) {
        const o = exercise.options[Number(e.key) - 1];
        if (o) setValue(o.id);
      } else if (!inField && !checked && exercise?.kind === 'multi' && /^[1-6]$/.test(e.key)) {
        const o = exercise.options[Number(e.key) - 1];
        if (o) {
          const cur = value.split(MULTI_SEP).filter(Boolean);
          const nxt = cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id].slice(-2);
          setValue(nxt.join(MULTI_SEP));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const word = exercise && exercise.kind !== 'pairs' ? data.words[exercise.wordId] : null;
  const ok = checked ? checked.grade !== 'wrong' : false;

  let title = '';
  if (checked && exercise) {
    if (checked.grade === 'correct') title = 'Bravo !';
    else if (checked.grade === 'almost' && word) title = `Presque ! Orthographe : ${word.word}`;
    else if (exercise.kind === 'choice') title = `Bonne réponse : ${exercise.options.find((o) => o.id === exercise.answerId)?.label}`;
    else if (exercise.kind === 'multi')
      title = `Bonne réponse : ${exercise.answerIds.map((id) => exercise.options.find((o) => o.id === id)?.label).join(' et ')}`;
    else if (exercise.kind === 'type' && word) title = `Bonne réponse : ${word.word}`;
    else title = 'À revoir';
  }

  function quit() {
    clearLesson();
    onExit();
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white">
      <header className="mx-auto flex w-full max-w-[760px] items-center gap-4 px-3 pt-4 sm:px-6">
        <button type="button" aria-label="Quitter la leçon" onClick={() => setConfirmQuit(true)} className="rounded-xl2 p-1 text-muted hover:bg-line">
          <X size={28} />
        </button>
        <ProgressBar value={progressRatio(state)} />
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-3 sm:px-6 pb-64 pt-8">
          {introWord && <Intro word={introWord} />}
          {exercise?.kind === 'choice' && (
            <MultipleChoice ex={exercise} value={value} onChange={setValue} locked={!!checked} autoPlay={progress.sound} />
          )}
          {exercise?.kind === 'multi' && <SentenceEquivalence ex={exercise} value={value} onChange={setValue} locked={!!checked} />}
          {exercise?.kind === 'type' && word && <TypeWord ex={exercise} word={word} value={value} onChange={setValue} locked={!!checked} />}
          {exercise?.kind === 'pairs' && (
            <MatchPairs
              key={exercise.wordIds.join()}
              ex={exercise}
              data={data}
              onComplete={(wrong) => setChecked({ grade: wrong.length ? 'wrong' : 'correct', wrongPairs: wrong })}
            />
          )}
        </div>
      </main>

      <footer className="shrink-0 border-t-2 border-line bg-white">
        <div className="mx-auto max-w-[760px] px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {introWord ? (
            <Button full onClick={next}>
              Continuer
            </Button>
          ) : exercise?.kind === 'pairs' ? (
            <Button full disabled>
              Associe toutes les paires
            </Button>
          ) : (
            <Button full disabled={!canCheck} onClick={check}>
              Vérifier
            </Button>
          )}
        </div>
      </footer>

      <FeedbackBar show={!!checked} ok={ok} title={exercise?.kind === 'pairs' ? (ok ? 'Bien joué !' : 'À revoir') : title} onContinue={next}>
        {checked && exercise?.kind === 'pairs' ? (
          <PairsRecap ids={checked.wrongPairs ?? []} />
        ) : (
          word && (
            <>
              <p>
                <strong>{word.word}</strong> — {word.definition} ({word.definitionFr})
              </p>
              <Sentence
                text={(exercise?.kind === 'choice' || exercise?.kind === 'multi') && exercise.sentence ? exercise.sentence : word.sentences[0]}
                word={word.word}
                className="italic"
              />
            </>
          )
        )}
      </FeedbackBar>

      {confirmQuit && (
        <Modal onClose={() => setConfirmQuit(false)}>
          <h2 className="mb-2 text-2xl font-extrabold text-ink">Quitter la leçon ?</h2>
          <p className="mb-6 text-muted">Ta progression dans cette leçon sera perdue.</p>
          <div className="grid gap-3">
            <Button full onClick={() => setConfirmQuit(false)}>
              Continuer la leçon
            </Button>
            <Button full variant="white" onClick={quit}>
              Quitter
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PairsRecap({ ids }: { ids: string[] }) {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return <p>Toutes les paires du premier coup.</p>;
  return (
    <>
      {uniq.map((id) => (
        <p key={id}>
          <strong>{data.words[id].word}</strong> — {data.words[id].definition} ({data.words[id].definitionFr})
        </p>
      ))}
    </>
  );
}
