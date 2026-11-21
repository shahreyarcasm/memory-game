import { CognitiveCategory, GameMetadata } from '../types/game';

const makeGame = (
  id: string,
  slug: string,
  title: string,
  category: CognitiveCategory,
  description: string,
  icon: string,
): GameMetadata => ({ id, slug, title, category, description, icon });

export const GAMES: GameMetadata[] = [
  makeGame(
    'digit-span',
    'digit-span',
    'Digit Span',
    'working-memory',
    'Remember sequences of numbers in order or reverse order. Trains short-term and working memory.',
    '123',
  ),
  makeGame(
    'spatial-matrix',
    'spatial-matrix',
    'Spatial Matrix',
    'working-memory',
    'Memorize highlighted grid positions and recall them. Exercises visuospatial memory.',
    '⊞',
  ),
  makeGame(
    'card-pairs',
    'card-pairs',
    'Card Pairs',
    'spatial',
    'Find matching pairs of cards in the grid. Classic visual recognition memory challenge.',
    '🂠',
  ),
  makeGame(
    'stroop',
    'stroop',
    'Stroop Challenge',
    'attention',
    'Name the ink color, not the word! Tests selective attention and cognitive inhibition.',
    'Aa',
  ),
  makeGame(
    'object-location',
    'object-location',
    'Object Grid',
    'recall',
    'Place objects back to their original locations. Builds spatial association skills.',
    '⊟',
  ),
  makeGame(
    'rapid-flash',
    'rapid-flash',
    'Rapid Flash',
    'reaction',
    'Click the target as fast as possible! Measures processing speed and reaction time.',
    '◉',
  ),
];

export const CATEGORY_LABELS: Record<CognitiveCategory, string> = {
  'working-memory': 'Working Memory',
  attention: 'Attention',
  spatial: 'Spatial & Visual',
  reaction: 'Reaction Speed',
  recall: 'Recall & Association',
};

export const CATEGORY_COLORS: Record<CognitiveCategory, string> = {
  'working-memory': 'from-blue-500 to-cyan-500',
  attention: 'from-amber-500 to-orange-500',
  spatial: 'from-emerald-500 to-teal-500',
  reaction: 'from-rose-500 to-pink-500',
  recall: 'from-violet-500 to-purple-500',
};
