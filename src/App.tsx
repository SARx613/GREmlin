import { useEffect, useRef, useState } from 'react';
import { data } from './lib/data';
import { buildQueue, createLesson, finishLesson, pickWords, type LessonResult } from './lib/session';
import { toggleStar } from './lib/daily';
import { canSpeak } from './lib/speak';
import { clearLesson, loadLesson, saveLesson } from './lib/storage';
import { currentStreak, masteredCount, recordDay, recordLesson } from './lib/srs';
import { useAccount } from './hooks/useAccount';
import { useProgress } from './hooks/useProgress';
import { useSettings } from './hooks/useSettings';
import { emptyState } from './lib/storage';
import Notices from './components/Notices';
import Blitz from './screens/Blitz';
import Sprint from './screens/Sprint';
import SpeedMatch from './screens/SpeedMatch';
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
  | { name: 'blitz' }
  | { name: 'sprint' }
  | { name: 'speedMatch' }
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

/** Mot à ouvrir à l'arrivée (clic sur une notification « mot surprise » : /?word=abate), puis on nettoie l'adresse. */
function takeWordParam(): string | null {
  const id = new URLSearchParams(window.location.search).get('word');
  if (id) window.history.replaceState(null, '', window.location.pathname);
  return id && data.words[id] ? id : null;
}

export default function App() {
  const { progress, update, replace, reset } = useProgress();
  const account = useAccount(progress, replace);
  const { settings, update: updateSettings } = useSettings();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [pending, setPending] = useState(loadPending);
  const [openWordId] = useState(takeWordParam);

  const homeScrollY = useRef(0);
  const targetChapterId = useRef<string | null>(null);

  const home = () => setScreen({ name: 'home' });
  const backFrom = (config: LessonConfig) =>
    config.chapterId ? setScreen({ name: 'chapter', chapterId: config.chapterId }) : home();

  const openChapter = (chapterId: string) => {
    homeScrollY.current = window.scrollY;
    targetChapterId.current = chapterId;
    setScreen({ name: 'chapter', chapterId });
  };

  const openOtherScreen = (s: Screen) => {
    if (screen.name === 'home') {
      homeScrollY.current = window.scrollY;
      targetChapterId.current = null;
    }
    setScreen(s);
  };

  useEffect(() => {
    if (screen.name === 'home') {
      requestAnimationFrame(() => {
        if (targetChapterId.current) {
          const el = document.querySelector(`[data-chapter="${targetChapterId.current}"]`);
          if (el) {
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
            targetChapterId.current = null;
            return;
          }
        }
        if (homeScrollY.current > 0) {
          window.scrollTo({ top: homeScrollY.current, left: 0, behavior: 'instant' });
        }
      });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [screen.name]);

  const onToggleStar = (id: string) => update((p) => ({ ...p, starred: toggleStar(p.starred, id) }));

  function startLesson(config: LessonConfig) {
    if (screen.name === 'home') {
      homeScrollY.current = window.scrollY;
      targetChapterId.current = config.chapterId ?? null;
    }
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
          openWordId={openWordId}
          onResume={() => pending && setScreen({ name: 'lesson', snapshot: pending })}
          onReview={() => startLesson({ mode: 'review' })}
          onChapter={openChapter}
          onToggleSound={() => update((p) => ({ ...p, sound: !p.sound }))}
          onBlitz={() => openOtherScreen({ name: 'blitz' })}
          onSprint={() => openOtherScreen({ name: 'sprint' })}
          onSpeedMatch={() => openOtherScreen({ name: 'speedMatch' })}
          onStats={() => openOtherScreen({ name: 'stats' })}
          onSettings={() => openOtherScreen({ name: 'settings' })}
          onToggleStar={onToggleStar}
          onStart={startLesson}
        />
      );
      break;
    case 'sprint':
      view = (
        <Sprint
          progress={progress}
          onBack={home}
          onStart={startLesson}
          onFinish={(score) =>
            update((p) => ({ ...p, sprint: { best: Math.max(p.sprint?.best ?? 0, score), plays: (p.sprint?.plays ?? 0) + 1 } }))
          }
        />
      );
      break;
    case 'speedMatch':
      view = (
        <SpeedMatch
          progress={progress}
          onBack={home}
          onStart={startLesson}
          onFinish={(score) =>
            update((p) => ({ ...p, speedMatch: { best: Math.max(p.speedMatch?.best ?? 0, score), plays: (p.speedMatch?.plays ?? 0) + 1 } }))
          }
        />
      );
      break;
    case 'blitz':
      view = (
        <Blitz
          progress={progress}
          onBack={home}
          onStart={startLesson}
          onFinish={(score) =>
            update((p) => ({ ...p, blitz: { best: Math.max(p.blitz?.best ?? 0, score), plays: (p.blitz?.plays ?? 0) + 1 } }))
          }
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
          onToggleStar={onToggleStar}
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
