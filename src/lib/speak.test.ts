import { describe, expect, it } from 'vitest';
import { rankVoices, voiceScore } from './speak';

const v = (name: string, lang = 'en-US', def = false) => ({ name, lang, default: def });

describe('choix de la voix', () => {
  const voices = [
    v('Zarvox'),
    v('Fred'),
    v('Bad News'),
    v('Daniel', 'en-GB'),
    v('Albert'),
    v('Alex', 'en_US'),
    v('Samantha'),
    v('Google US English'),
    v('Microsoft Aria Online (Natural) - English (United States)'),
    v('Ava (Premium)'),
  ];

  it('exclut les voix de fantaisie et les autres accents', () => {
    const names = rankVoices(voices, 'en-US').map((x) => x.name);
    for (const bad of ['Zarvox', 'Fred', 'Bad News', 'Albert', 'Daniel']) expect(names).not.toContain(bad);
  });

  it('classe les voix naturelles / haute qualité en premier', () => {
    const names = rankVoices(voices, 'en-US').map((x) => x.name);
    expect(names[0]).toBe('Microsoft Aria Online (Natural) - English (United States)');
    expect(names.indexOf('Google US English')).toBeLessThan(names.indexOf('Samantha'));
    expect(names.indexOf('Ava (Premium)')).toBeLessThan(names.indexOf('Samantha'));
  });

  it('accepte le format Android « en_US »', () => {
    expect(rankVoices(voices, 'en-US').map((x) => x.name)).toContain('Alex');
  });

  it('une voix inconnue vaut 0, sans plantage', () => {
    expect(voiceScore(v('Voix Inconnue'))).toBe(0);
  });

  it('accent britannique : seulement les voix en-GB', () => {
    expect(rankVoices(voices, 'en-GB').map((x) => x.name)).toEqual(['Daniel']);
  });
});
