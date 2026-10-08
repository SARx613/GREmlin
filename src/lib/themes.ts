import rawFamilies from '../../data/families.json';
import { data } from './data';

export type Contrast = {
  id: string;
  title: string;
  conceptA: { label: string; wordIds: string[] };
  conceptB: { label: string; wordIds: string[] };
};

export type SynonymFamily = {
  id: string;
  label: string;
  wordIds: string[];
};

export type Lookalike = {
  id: string;
  title: string;
  wordA: string;
  wordB: string;
  distinction: string;
};

// --- Les 20 Grands Duels de Contraires (Antonymes clés du GRE) ----------------

const RAW_CONTRASTS: Contrast[] = [
  {
    id: 'c-abundance-scarcity',
    title: 'Abondance ↔ Rareté & Pénurie',
    conceptA: {
      label: 'Abondance & Profusion',
      wordIds: ['copious', 'plethora', 'surfeit', 'replete', 'rife', 'burgeon', 'profuse', 'plentiful'],
    },
    conceptB: {
      label: 'Rareté & Pénurie',
      wordIds: ['dearth', 'paucity', 'scant', 'scarce', 'sparse', 'meager', 'shortfall', 'penury', 'paltry'],
    },
  },
  {
    id: 'c-praise-criticize',
    title: 'Éloges ↔ Critiques & Dénigrement',
    conceptA: {
      label: 'Louer & Porter aux nues',
      wordIds: ['extol', 'lionize', 'tout', 'laud', 'acclaim'],
    },
    conceptB: {
      label: 'Blâmer & Dénigrer',
      wordIds: ['castigate', 'lambaste', 'chastise', 'disparage', 'belittle', 'malign', 'rebuke', 'admonish', 'censure', 'upbraid'],
    },
  },
  {
    id: 'c-calm-anger',
    title: 'Apaiser & Calmer ↔ Attiser & Irriter',
    conceptA: {
      label: 'Apaiser & Soulager',
      wordIds: ['assuage', 'mollify', 'placate', 'allay', 'mitigate', 'temper', 'abate', 'subside'],
    },
    conceptB: {
      label: 'Attiser & Exaspérer',
      wordIds: ['exacerbate', 'irk', 'rankle', 'incense'],
    },
  },
  {
    id: 'c-brief-wordy',
    title: 'Clair & Concis ↔ Verbeux & Bavard',
    conceptA: {
      label: 'Concis & Percutant',
      wordIds: ['laconic', 'terse', 'pithy', 'cogent', 'brevity', 'curt'],
    },
    conceptB: {
      label: 'Verbeux & Prolixe',
      wordIds: ['loquacious', 'garrulous', 'prolix', 'verbose', 'bombastic', 'florid', 'discursive'],
    },
  },
  {
    id: 'c-stubborn-compliant',
    title: 'Têtu & Rebelle ↔ Docile & Soumis',
    conceptA: {
      label: 'Obstiné & Rétif',
      wordIds: ['intractable', 'obstinate', 'recalcitrant', 'hidebound', 'headstrong'],
    },
    conceptB: {
      label: 'Docile & Accommodant',
      wordIds: ['tractable', 'amenable', 'subservient', 'fawning'],
    },
  },
  {
    id: 'c-ephemeral-enduring',
    title: 'Éphémère & Passager ↔ Durable & Perpétuel',
    conceptA: {
      label: 'Éphémère & Fuyant',
      wordIds: ['ephemeral', 'evanescent', 'transient', 'fleeting'],
    },
    conceptB: {
      label: 'Durable & Constant',
      wordIds: ['perennial', 'immutable', 'steadfast', 'stalwart', 'inveterate'],
    },
  },
  {
    id: 'c-frugal-wasteful',
    title: 'Économe & Modéré ↔ Gaspilleur & Prodigue',
    conceptA: {
      label: 'Économe & Sobre',
      wordIds: ['frugal', 'thrifty', 'sparing', 'parsimonious', 'stinting'],
    },
    conceptB: {
      label: 'Prodigue & Dilapidateur',
      wordIds: ['profligate', 'spendthrift', 'squander', 'lavish'],
    },
  },
  {
    id: 'c-candid-deceitful',
    title: 'Franc & Sincère ↔ Rusé & Trompeur',
    conceptA: {
      label: 'Franc & Transparent',
      wordIds: ['candid', 'ingenuous', 'artless', 'blunt'],
    },
    conceptB: {
      label: 'Fourbe & Trompeur',
      wordIds: ['disingenuous', 'guile', 'mendacity', 'specious', 'spurious', 'artful', 'chicanery', 'hoodwink', 'dissemble'],
    },
  },
  {
    id: 'c-support-weaken',
    title: 'Soutenir & Renforcer ↔ Saper & Affaiblir',
    conceptA: {
      label: 'Étayer & Renforcer',
      wordIds: ['bolster', 'buttress', 'substantiate', 'underscore', 'uphold', 'corroborate'],
    },
    conceptB: {
      label: 'Saper & Dégrader',
      wordIds: ['undermine', 'undercut', 'vitiate', 'impair', 'mar'],
    },
  },
  {
    id: 'c-bold-timid',
    title: 'Audacieux & Téméraire ↔ Craintif & Prudent',
    conceptA: {
      label: 'Audacieux & Intrépide',
      wordIds: ['audacious', 'intrepid', 'brazen', 'brash', 'foolhardy'],
    },
    conceptB: {
      label: 'Craintif & Méfiant',
      wordIds: ['craven', 'diffident', 'wary', 'chary', 'skittish'],
    },
  },
  {
    id: 'c-active-lethargic',
    title: 'Énergie & Zèle ↔ Mou & Léthargique',
    conceptA: {
      label: 'Élan & Enthousiasme',
      wordIds: ['alacrity', 'sedulous', 'invigorate', 'spur', 'buoy'],
    },
    conceptB: {
      label: 'Léthargie & Apathie',
      wordIds: ['sluggish', 'plodding', 'lackadaisical', 'torpor'],
    },
  },
  {
    id: 'c-clear-obscure',
    title: 'Évident & Manifeste ↔ Obscur & Énigmatique',
    conceptA: {
      label: 'Évident & Frappant',
      wordIds: ['conspicuous', 'blatant', 'glaring', 'overt', 'stark', 'patent'],
    },
    conceptB: {
      label: 'Obscur & Ésotérique',
      wordIds: ['equivocal', 'obscure', 'recondite', 'arcane', 'inscrutable'],
    },
  },
  {
    id: 'c-perceptive-confused',
    title: 'Perspicace & Clairvoyant ↔ Désorienté & Dérouté',
    conceptA: {
      label: 'Perspicace & Lucide',
      wordIds: ['fathom', 'discern', 'shrewd', 'canny', 'acumen'],
    },
    conceptB: {
      label: 'Désarçonné & Confus',
      wordIds: ['baffle', 'bewilder', 'flummox', 'confound', 'nonplussed'],
    },
  },
  {
    id: 'c-friendly-hostile',
    title: 'Harmonie & Accord ↔ Haine & Hostilité',
    conceptA: {
      label: 'Concorde & Bienveillance',
      wordIds: ['amity', 'comity', 'congenial'],
    },
    conceptB: {
      label: 'Hostilité & Rancœur',
      wordIds: ['enmity', 'animus', 'umbrage', 'ire', 'spiteful'],
    },
  },
  {
    id: 'c-harmless-harmful',
    title: 'Inoffensif & Bénin ↔ Nocif & Toxique',
    conceptA: {
      label: 'Inoffensif',
      wordIds: ['innocuous', 'benign'],
    },
    conceptB: {
      label: 'Nocif & Destructeur',
      wordIds: ['deleterious', 'noxious', 'insidious', 'pernicious'],
    },
  },
  {
    id: 'c-adept-clumsy',
    title: 'Habile & Expert ↔ Lourd & Maladroit',
    conceptA: {
      label: 'Dextérité & Habileté',
      wordIds: ['adept', 'adroit', 'deft', 'nimble'],
    },
    conceptB: {
      label: 'Lourd & Encombrant',
      wordIds: ['unwieldy', 'cumbersome', 'ponderous'],
    },
  },
  {
    id: 'c-modest-arrogant',
    title: 'Humble & Réservé ↔ Arrogant & Dominateur',
    conceptA: {
      label: 'Discret & Modeste',
      wordIds: ['diffident', 'coy', 'reticent'],
    },
    conceptB: {
      label: 'Arrogant & Condescendant',
      wordIds: ['haughty', 'domineering', 'smug', 'imperious'],
    },
  },
  {
    id: 'c-ordinary-innovative',
    title: 'Banal & Ordinaire ↔ Pionnier & Révolutionnaire',
    conceptA: {
      label: 'Banal & Quotidien',
      wordIds: ['prosaic', 'pedestrian', 'mundane', 'platitude', 'quotidian'],
    },
    conceptB: {
      label: 'Pionnier & Indépendant',
      wordIds: ['trailblazer', 'groundbreaking', 'maverick'],
    },
  },
];

// --- Sosies & Pièges Fréquents (Lookalikes / Confusion Pairs) -----------------

export const LOOKALIKES: Lookalike[] = [
  {
    id: 'look-ingenuous-ingenious',
    title: 'Ingenuous vs Ingenious',
    wordA: 'ingenuous',
    wordB: 'ingenious',
    distinction: 'Ingenuous = candide, franc, naïf (sans ruse) · Ingenious = ingénieux, brillant, très créatif.',
  },
  {
    id: 'look-discreet-discrete',
    title: 'Discreet vs Discrete',
    wordA: 'discreet',
    wordB: 'discrete',
    distinction: 'Discreet (avec double e) = discret, réservé · Discrete (e-t-e) = distinct, séparé, discontinu.',
  },
  {
    id: 'look-adverse-averse',
    title: 'Adverse vs Averse',
    wordA: 'adverse',
    wordB: 'averse',
    distinction: 'Adverse = défavorable, nuisible (adverse conditions) · Averse = réticent, opposé à (risk-averse).',
  },
  {
    id: 'look-impassive-impassioned',
    title: 'Impassive vs Impassioned',
    wordA: 'impassive',
    wordB: 'impassioned',
    distinction: 'Impassive = impassible, stoïque, sans émotion · Impassioned = passionné, vibrant, ardent.',
  },
  {
    id: 'look-prosaic-prolix',
    title: 'Prosaic vs Prolix',
    wordA: 'prosaic',
    wordB: 'prolix',
    distinction: 'Prosaic = banal, sans relief, terre-à-terre · Prolix = verbeux, bavard, ennuyeusement long.',
  },
  {
    id: 'look-bellicose-belligerent',
    title: 'Bellicose vs Belligerent',
    wordA: 'bellicose',
    wordB: 'belligerent',
    distinction: 'Bellicose = belliqueux, querelleur par nature · Belligerent = belligérant, activement engagé dans un conflit.',
  },
  {
    id: 'look-complacent-compliant',
    title: 'Complacent vs Subservient',
    wordA: 'complacent',
    wordB: 'subservient',
    distinction: 'Complacent = autosatisfait, endormi sur ses lauriers · Subservient = soumis, servile, rampant.',
  },
  {
    id: 'look-tractable-intractable',
    title: 'Tractable vs Intractable',
    wordA: 'tractable',
    wordB: 'intractable',
    distinction: 'Tractable = docile, maniable, obéissant · Intractable = intraitable, rebelle, impossible à gérer.',
  },
  {
    id: 'look-candid-dissemble',
    title: 'Candid vs Dissemble',
    wordA: 'candid',
    wordB: 'dissemble',
    distinction: 'Candid = honnête, franc et direct · Dissemble = dissimuler, feindre, cacher ses vrais sentiments.',
  },
  {
    id: 'look-equivocal-cogent',
    title: 'Equivocal vs Cogent',
    wordA: 'equivocal',
    wordB: 'cogent',
    distinction: 'Equivocal = ambigu, équivoque, douteux · Cogent = clair, convaincant, percutant.',
  },
];

// Nettoyer et valider les contrastes par rapport aux mots existants
export const CONTRASTS: Contrast[] = RAW_CONTRASTS.map((c) => ({
  ...c,
  conceptA: {
    ...c.conceptA,
    wordIds: c.conceptA.wordIds.filter((id) => data.words[id]),
  },
  conceptB: {
    ...c.conceptB,
    wordIds: c.conceptB.wordIds.filter((id) => data.words[id]),
  },
})).filter((c) => c.conceptA.wordIds.length > 0 && c.conceptB.wordIds.length > 0);

// Familles de synonymes enrichies
const ADDITIONAL_FAMILIES = [
  { label: 'Habile et expert', words: ['adept', 'adroit', 'deft', 'nimble'] },
  { label: 'Nocif et toxique', words: ['deleterious', 'noxious', 'pernicious', 'insidious'] },
  { label: 'Audacieux et effronté', words: ['audacious', 'intrepid', 'brazen', 'brash', 'foolhardy', 'insolent'] },
  { label: 'Peur et lâcheté', words: ['craven', 'timorous', 'diffident', 'skittish'] },
  { label: 'Banal et ordinaire', words: ['prosaic', 'pedestrian', 'mundane', 'platitude', 'quotidian'] },
  { label: 'Bavard et prolixe', words: ['loquacious', 'garrulous', 'prolix', 'verbose'] },
  { label: 'Sévère et strict', words: ['austere', 'stringent', 'rigorous', 'exacting', 'ascetic'] },
  { label: 'Généreux et altruiste', words: ['altruistic', 'benevolent', 'magnanimous', 'beneficent'] },
  { label: 'Changement et fluctuation', words: ['waver', 'vacillate', 'mercurial', 'protean'] },
  { label: 'Faux et fallacieux', words: ['specious', 'spurious', 'fallacious', 'illusory'] },
];

export const SYNONYM_FAMILIES: SynonymFamily[] = [
  ...(rawFamilies as { label: string; words: string[] }[]),
  ...ADDITIONAL_FAMILIES,
]
  .map((f, i) => ({
    id: `fam-${i}`,
    label: f.label,
    wordIds: f.words.filter((id) => data.words[id]),
  }))
  .filter((f) => f.wordIds.length >= 2);

