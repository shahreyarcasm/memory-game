// Curated, scientifically supported "Did You Know?" facts.
// Each entry is short, accurate, and avoids pop-neuromyths (no "10% of the brain",
// no "left-brained people", no "brain training transfers to everything").

export interface MemoryFact {
  text: string;
  topic: 'memory' | 'neuroscience' | 'attention' | 'learning' | 'sleep' | 'cognition';
}

export const FACTS: MemoryFact[] = [
  {
    topic: 'memory',
    text: 'Working memory holds roughly four chunks of information at a time for most adults — about the same as a short phone number.',
  },
  {
    topic: 'neuroscience',
    text: 'Every time you learn something new, the physical connections between neurons in your brain change. Learning literally reshapes your brain.',
  },
  {
    topic: 'learning',
    text: 'Spacing practice across several days beats one long study session. Your brain consolidates memories during the gaps between sessions.',
  },
  {
    topic: 'sleep',
    text: 'Deep sleep is when the hippocampus replays the day\'s events and transfers them into long-term storage in the cortex.',
  },
  {
    topic: 'memory',
    text: 'The word "mnemonic" comes from Mnemosyne, the Greek goddess of memory and the mother of the nine Muses.',
  },
  {
    topic: 'attention',
    text: 'Task-switching has a measurable cost: even a few seconds of unrelated activity can slow you down on the task you came back to.',
  },
  {
    topic: 'learning',
    text: 'Testing yourself before you know the answer improves later recall — the struggle to retrieve is what strengthens the memory.',
  },
  {
    topic: 'memory',
    text: 'People can recognize thousands of images with over 90% accuracy even after seeing each one for just three seconds.',
  },
  {
    topic: 'neuroscience',
    text: 'Your brain uses about 20% of your body\'s energy despite being roughly 2% of its weight.',
  },
  {
    topic: 'memory',
    text: 'HM, a famous patient who lost the ability to form new memories, could still learn new motor skills — proof that memory comes in multiple systems.',
  },
  {
    topic: 'attention',
    text: 'In the Stroop effect, naming the ink color of a mismatched word takes measurably longer than reading the word itself — reading is so automatic it\'s hard to switch off.',
  },
  {
    topic: 'learning',
    text: 'Chunking turns many items into few: expert chess players memorize board positions better than novices by grouping pieces into meaningful patterns.',
  },
  {
    topic: 'memory',
    text: 'The method of loci — placing ideas along a familiar route in your mind — has been used since Roman times and still underpins modern memory champions\' techniques.',
  },
  {
    topic: 'cognition',
    text: 'Practising a skill mentally, without moving, activates overlapping brain regions with physical practice and can improve later performance.',
  },
  {
    topic: 'sleep',
    text: 'A 60–90 minute nap after learning can protect new memories from interference, similar in benefit to a full night of sleep.',
  },
  {
    topic: 'cognition',
    text: 'Reaction time improves with practice, but the gains are task-specific: getting faster at one game doesn\'t automatically make you faster at all of them.',
  },
  {
    topic: 'memory',
    text: 'Memories are not played back like video — each recall reconstructs the event, which is why revisiting a memory can subtly change it.',
  },
  {
    topic: 'neuroscience',
    text: 'The hippocampus is critical for forming new episodic memories, but very old memories may live mostly in the cortex instead.',
  },
  {
    topic: 'attention',
    text: 'Holding a phone nearby — even face down and silent — can reduce available working memory for demanding tasks.',
  },
  {
    topic: 'learning',
    text: 'Errors speed up learning when they are small and informative; the brain adjusts most when feedback is close to the target.',
  },
  {
    topic: 'cognition',
    text: 'Dual-task performance drops sharply when both tasks need the same kind of attention — which is why studying with a phone is worse than with music.',
  },
  {
    topic: 'memory',
    text: 'Most people can hold a sequence of about 7 digits briefly, but rehearsal and grouping push the effective limit higher.',
  },
  {
    topic: 'neuroscience',
    text: 'Myelin, the fatty coating around neurons, thickens with repeated practice — a physical signature of becoming better at a skill.',
  },
  {
    topic: 'learning',
    text: 'Interleaving different but related problems in one session improves long-term discrimination better than practising one type at a time.',
  },
  {
    topic: 'sleep',
    text: 'Sleep deprivation reduces hippocampal activity the next day — pulling an all-nighter to memorize is measurably counterproductive.',
  },
  {
    topic: 'attention',
    text: 'Mind-wandering occupies up to half of waking thought during easy tasks, and people report being less happy when they notice it.',
  },
  {
    topic: 'cognition',
    text: 'Spatial navigation training increases gray matter in the hippocampus in adults — your sense of direction is trainable.',
  },
];

/**
 * Pick a fact for a new session, avoiding the last few shown (stored per-device).
 */
export function pickSessionFact(history: number[]): MemoryFact {
  const recent = new Set(history.slice(-8));
  const candidates = FACTS.map((fact, idx) => ({ fact, idx })).filter(({ idx }) => !recent.has(idx));
  const pool = candidates.length > 0 ? candidates : FACTS.map((fact, idx) => ({ fact, idx }));
  const choice = pool[Math.floor(Math.random() * pool.length)];
  return choice.fact;
}
