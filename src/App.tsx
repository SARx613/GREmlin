import { useState } from 'react';
import { data } from './lib/data';
import { buildQueue, createLesson, finishLesson, pickWords, type LessonResult } from './lib/session';
import { canSpeak } from './lib/speak';
import { clearLesson, loadLesson, saveLesson } from './lib/storage';
import { currentStreak, masteredCount, recordDay, recordLesson } from './lib/srs';
import { useAccount } from './hooks/useAccount';
import { useProgress } from './hooks/useProgress';
import { useSettings } from './hooks/useSettings';
import { emptyState } from './lib/storage';
import Notices from './components/Notices';
import Chapter from './screens/Chapter';
import Home from './screens/Home';
import Lesson from './screens/Lesson';
import Settings from './screens/Settings';
import Stats from './screens/Stats';
import LessonEnd from './screens/LessonEnd';
import Triage from './screens/Triage';
import type { LessonConfig, LessonSnapshot, LessonState } from './types';

type Screen =
  | { name: 'home' }
  | { name: 'stats' }
  | { name: 'settings' }
  | { name: 'chapter'; chapterId: string }
  | { name: 'triage'; chapterId: string }
  | { name: 'lesson'; snapshot: LessonSnapshot }
  | { name: 'end'; config: LessonConfig; result: LessonResult };

/** Leçon interrompue par un rechargement, si elle est encore valide. */
function loadPending(): LessonSnapshot | null {
  const s = loadLesson();
  return s && s.state.wordIds.every((id) => data.words[id]) ? s : null;
}

export default function App() {
  const { progress, update, replace, reset } = useProgress();
  const account = useAccount(progress, replace);
  const { settings, update: updateSettings } = useSettings();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [pending, setPending] = useState(loadPending);

  const home = () => setScreen({ name: 'home' });
  const backFrom = (config: LessonConfig) =>
    config.chapterId ? setScreen({ name: 'chapter', chapterId: config.chapterId }) : home();

  function startLesson(config: LessonConfig) {
    const { ids, applySrs } = pickWords(config, data, progress.words, Date.now());
    if (!ids.length) return;
    const snapshot: LessonSnapshot = {
      config,
      applySrs,
      state: createLesson(ids, buildQueue(ids, data, progress.words, Math.random, progress.sound && canSpeak())),
    };
    saveLesson(snapshot);
    setPending(snapshot);
    setScreen({ name: 'lesson', snapshot });
  }

  function finish(state: LessonState, snapshot: LessonSnapshot) {
    const now = Date.now();
    const result = finishLesson(state, progress.words, now, snapshot.applySrs);
    const mastered = masteredCount(data.chapters.flatMap((c) => c.wordIds), result.words);
    update((p) => ({ ...p, words: result.words, streak: recordLesson(p.streak, now), days: recordDay(p.days, now, mastered) }));
    clearLesson();
    setPending(null);
    setScreen({ name: 'end', config: snapshot.config, result });
  }

  let view;
  switch (screen.name) {
    case 'home':
      view = (
        <Home
          progress={progress}
          dailyGoal={settings.dailyGoal}
          hasPending={!!pending}
          onResume={() => pending && setScreen({ name: 'lesson', snapshot: pending })}
          onReview={() => startLesson({ mode: 'review' })}
          onChapter={(chapterId) => setScreen({ name: 'chapter', chapterId })}
          onToggleSound={() => update((p) => ({ ...p, sound: !p.sound }))}
          onStats={() => setScreen({ name: 'stats' })}
          onSettings={() => setScreen({ name: 'settings' })}
        />
      );
      break;
    case 'stats':
      view = <Stats progress={progress} onBack={home} onStart={startLesson} />;
      break;
    case 'settings':
      view = (
        <Settings
          settings={settings}
          onChange={updateSettings}
          progress={progress}
          account={account}
          onToggleSound={() => update((p) => ({ ...p, sound: !p.sound }))}
          onImport={replace}
          onReset={() => {
            reset();
            void account.overwrite(emptyState());
            setPending(null);
          }}
          onBack={home}
        />
      );
      break;
    case 'chapter':
      view = (
        <Chapter
          chapterId={screen.chapterId}
          progress={progress}
          onBack={home}
          onStart={startLesson}
          onTriage={() => setScreen({ name: 'triage', chapterId: screen.chapterId })}
        />
      );
      break;
    case 'triage':
      view = (
        <Triage
          chapterId={screen.chapterId}
          progress={progress}
          update={update}
          onBack={() => setScreen({ name: 'chapter', chapterId: screen.chapterId })}
        />
      );
      break;
    case 'lesson':
      // la clé repart de zéro quand on lance une autre leçon
      view = (
        <Lesson
          key={screen.snapshot.state.wordIds.join() + screen.snapshot.state.total}
          snapshot={screen.snapshot}
          progress={progress}
          onExit={() => {
            setPending(null);
            backFrom(screen.snapshot.config);
          }}
          onFinish={(state) => finish(state, screen.snapshot)}
        />
      );
      break;
    case 'end':
      view = (
        <LessonEnd
          result={screen.result}
          streak={currentStreak(progress.streak, Date.now())}
          canRepeat={pickWords(screen.config, data, progress.words, Date.now()).ids.length > 0}
          onAgain={() => startLesson(screen.config)}
          onBack={() => backFrom(screen.config)}
        />
      );
      break;
  }

  // l'écran de leçon occupe toute la hauteur ; les autres sont dans une colonne centrée
  return (
    <>
      <Notices />
      {screen.name === 'lesson' ? view : <div className="mx-auto min-h-full w-full max-w-[760px] px-3 sm:px-6">{view}</div>}
    </>
  );
}
