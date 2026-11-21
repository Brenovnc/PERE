import { describe, expect, it } from 'vitest';
import {
  applyAnswer,
  EngineContext,
  exposureSegments,
  inferRating,
  moduleSummary,
  revealHint,
  startSession,
  submitAnswer,
} from './engine';
import {
  ConceptDocument,
  ModuleDocument,
  ModuleImportError,
  parseModuleDocument,
  toModuleContent,
} from './exchange';
import { ConceptState, createProgress, VisitorProgress } from './model';

function concept(id: string, prerequisites: string[] = []): ConceptDocument {
  return {
    externalId: id,
    name: `Conceito ${id}`,
    definition: `${id} usa chave e valor.`,
    keywords: [{ value: 'chave' }, { value: 'valor' }],
    clues: [{ text: `Pista 1 de ${id}` }, { text: `Pista 2 de ${id}` }],
    prerequisites,
    trueFalseActivities: [{ statement: 'Verdade', isCorrect: true, explanation: 'Porque sim.' }],
    fillBlankActivities: [
      {
        text: '{{1}} e {{2}}',
        answers: [
          { slotNumber: 1, correctText: 'A' },
          { slotNumber: 2, correctText: 'B' },
        ],
        distractors: ['Z'],
      },
    ],
    orderingActivities: [],
  };
}

function documentWith(...concepts: ConceptDocument[]): ModuleDocument {
  return {
    schemaVersion: 1,
    module: {
      externalId: 'module',
      title: 'Módulo',
      description: null,
      subject: 'Teste',
      version: 1,
      crosswordEnabled: false,
      crosswordAllowAllWords: false,
      concepts,
    },
  };
}

/** Fixed clock that the test can move, ids in sequence and no shuffling. */
function context(start = '2026-01-01T12:00:00Z') {
  let id = 0;
  const ctx: EngineContext & { advance(ms: number): void } = {
    now: new Date(start),
    random: () => 0,
    newId: () => `id-${++id}`,
    advance(ms: number) {
      this.now = new Date(this.now.getTime() + ms);
    },
  };
  return ctx;
}

/** A correct (or wrong) answer for each activity type of the test concepts. */
function answerFor(type: string, correct: boolean): unknown {
  const answers: Record<string, unknown> = {
    EXPOSURE: { completed: true },
    TRUE_FALSE: { choice: correct },
    FILL_BLANK: {
      answers: [
        { slotNumber: 1, text: correct ? 'a' : 'z' },
        { slotNumber: 2, text: 'B' },
      ],
    },
    GUESS_CONCEPT: { text: correct ? ' conceito A ' : 'outro' },
  };
  return answers[type];
}

const minutes = 60_000;
const days = 86_400_000;

function responseState(learningState: ConceptState['learningState']): ConceptState {
  return {
    learningState,
    freeRecallSuccessCount: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFreeRecallSuccessAt: null,
    lastFreeRecallSuccessSessionId: null,
    card: null,
    lastRating: null,
  };
}

describe('module import (schemaVersion 1)', () => {
  it('accepts a valid module and keeps only active content', () => {
    const doc = documentWith(concept('a'), { ...concept('b'), isActive: false });
    doc.module.concepts[0].keywords.push({ value: 'inativa', isActive: false });
    const content = toModuleContent(parseModuleDocument(JSON.stringify(doc)));
    expect(content.concepts.map((c) => c.id)).toEqual(['a']);
    expect(content.concepts[0].keywords).toEqual(['chave', 'valor']);
  });

  it('rejects other formats, missing prerequisites and cycles', () => {
    expect(() => parseModuleDocument('{"schemaVersion":2}')).toThrow(ModuleImportError);
    expect(() => parseModuleDocument(JSON.stringify(documentWith(concept('a', ['x']))))).toThrow(
      ModuleImportError,
    );
    const cycle = documentWith(concept('a', ['b']), concept('b', ['a']));
    expect(() => parseModuleDocument(JSON.stringify(cycle))).toThrow(/erros/);
  });

  it('rejects fill-in-the-blank slots that do not match the answers', () => {
    const doc = documentWith(concept('a'));
    doc.module.concepts[0].fillBlankActivities[0].text = 'Só {{1}}';
    try {
      parseModuleDocument(JSON.stringify(doc));
      expect.unreachable();
    } catch (error) {
      expect((error as ModuleImportError).details[0]).toContain('fillBlankActivities[0]');
    }
  });
});

describe('activity selection', () => {
  it('starts with the exposure of a concept whose prerequisites are mastered', () => {
    const content = toModuleContent(documentWith(concept('b', ['a']), concept('a')));
    const progress = createProgress('m', new Date());
    const session = startSession(content, progress, 'NORMAL', null, context());
    const first = session.presentations[0];
    expect(first.type).toBe('EXPOSURE');
    expect(first.conceptId).toBe('a');
    expect(progress.states['a'].learningState).toBe('EXPOSURE');
    expect(progress.states['b']).toBeUndefined();
  });

  it('ends a session after 10 activities', () => {
    const many = Array.from({ length: 12 }, (_, i) => concept(`c${String(i).padStart(2, '0')}`));
    const content = toModuleContent(documentWith(...many));
    const progress = createProgress('m', new Date());
    const ctx = context();
    const session = startSession(content, progress, 'NORMAL', null, ctx);
    for (let i = 0; i < 10; i++) {
      const current = session.presentations.at(-1)!;
      if (current.type === 'EXPOSURE')
        for (let k = 0; k < 2; k++) revealHint(progress, session.id, current.id);
      submitAnswer(
        content,
        progress,
        session.id,
        current.id,
        answerFor(current.type, true),
        0,
        ctx,
      );
    }
    expect(session.status).toBe('COMPLETED');
    expect(session.completedActivities).toBe(10);
  });
});

describe('progression', () => {
  function answerCurrent(
    content: ReturnType<typeof toModuleContent>,
    progress: VisitorProgress,
    sessionId: string,
    correct: boolean,
    ctx: ReturnType<typeof context>,
  ) {
    const session = progress.sessions.find((s) => s.id === sessionId)!;
    const current = session.presentations.at(-1)!;
    const answer = answerFor(current.type, correct);
    return submitAnswer(content, progress, sessionId, current.id, answer, 0, ctx);
  }

  it('moves EXPOSURE → RECOGNITION → GUIDED_RECALL and back on a mistake', () => {
    const content = toModuleContent(documentWith(concept('a')));
    const progress = createProgress('m', new Date());
    const ctx = context();
    const session = startSession(content, progress, 'NORMAL', null, ctx);
    const exposure = session.presentations[0];
    expect(() =>
      submitAnswer(content, progress, session.id, exposure.id, { completed: true }, 0, ctx),
    ).toThrow(/Revele/);
    revealHint(progress, session.id, exposure.id);
    revealHint(progress, session.id, exposure.id);
    const afterExposure = submitAnswer(
      content,
      progress,
      session.id,
      exposure.id,
      { completed: true },
      0,
      ctx,
    );
    expect(afterExposure.learningState).toBe('RECOGNITION');
    expect(afterExposure.nextActivity?.type).toBe('TRUE_FALSE');

    expect(answerCurrent(content, progress, session.id, true, ctx).learningState).toBe(
      'GUIDED_RECALL',
    );
    const wrong = answerCurrent(content, progress, session.id, false, ctx);
    expect(wrong.wasCorrect).toBe(false);
    expect(wrong.learningState).toBe('RECOGNITION');
    expect(wrong.correctAnswer).toEqual({
      answers: [
        { slotNumber: 1, text: 'A' },
        { slotNumber: 2, text: 'B' },
      ],
    });
  });

  it('masters a concept only after a second free-recall success in another session, once due', () => {
    const state = responseState('FREE_RECALL');
    const start = new Date('2026-01-01T12:00:00Z');
    applyAnswer(state, 's1', true, 1, 0, 8_000, start);
    expect(state.freeRecallSuccessCount).toBe(1);
    applyAnswer(state, 's1', true, 1, 0, 8_000, new Date(start.getTime() + 20 * minutes));
    expect(state.learningState).toBe('FREE_RECALL');
    const due = Date.parse(state.card!.due);
    applyAnswer(state, 's2', true, 1, 0, 8_000, new Date(due + minutes));
    expect(state.learningState).toBe('MASTERED');
    applyAnswer(state, 's3', false, 1, 0, 8_000, new Date(due + 2 * days));
    expect(state.learningState).toBe('FREE_RECALL');
    expect(state.freeRecallSuccessCount).toBe(0);
  });

  it('free practice never changes official progress', () => {
    const content = toModuleContent(documentWith(concept('a')));
    const progress = createProgress('m', new Date());
    const ctx = context();
    const session = startSession(content, progress, 'FREE_PRACTICE', null, ctx);
    const result = answerCurrent(content, progress, session.id, true, ctx);
    expect(result.learningState).toBe('FREE_PRACTICE');
    expect(progress.states).toEqual({});
    expect(progress.practiceUsage['a']).toBeGreaterThan(0);
  });

  it('summarizes progress like the student catalog', () => {
    const content = toModuleContent(documentWith(concept('a'), concept('b')));
    const progress = createProgress('m', new Date());
    progress.states['a'] = { ...responseState('MASTERED') };
    progress.states['b'] = { ...responseState('RECOGNITION') };
    const summary = moduleSummary(
      'm',
      content,
      progress,
      { name: null, institution: null },
      new Date(),
    );
    expect(summary).toMatchObject({
      masteredConcepts: 1,
      learningConcepts: 1,
      notStartedConcepts: 0,
      progressPercent: 50,
    });
  });
});

describe('rating and FSRS scheduling', () => {
  it('infers the rating like PerformanceRatingService', () => {
    expect(inferRating(false, 1, 0, 1000)).toBe('Again');
    expect(inferRating(true, 1, 2, 1000)).toBe('Hard');
    expect(inferRating(true, 1, 0, 4000)).toBe('Easy');
    expect(inferRating(true, 1, 1, 4000)).toBe('Good');
    expect(inferRating(true, 1, 0, 6000)).toBe('Good');
  });

  it('schedules the same intervals as Fsrs.Sharp (FSRS-6, no fuzzing)', () => {
    // Values measured with Fsrs.Sharp 2.0.0 for "Good, Good, Good, Again", each at its due time.
    const state = responseState('RECOGNITION');
    let now = new Date('2026-01-01T12:00:00Z');
    const expected = [
      { due: '2026-01-01T12:10:00.000Z', stability: 2.3065 },
      { due: '2026-01-03T12:10:00.000Z', stability: 2.3065 },
      { due: '2026-01-14T12:10:00.000Z', stability: 10.971 },
      { due: '2026-01-14T12:20:00.000Z', stability: 1.539 },
    ];
    expected.forEach((step, index) => {
      applyAnswer(state, 's', index < 3, 1, 0, 8_000, now);
      expect(state.card!.due).toBe(step.due);
      expect(state.card!.stability).toBeCloseTo(step.stability, 4);
      now = new Date(state.card!.due);
    });
  });
});

describe('exposure segments', () => {
  it('hides keywords until revealed and lists keywords missing from the text at the end', () => {
    const segments = exposureSegments('Use a Chave certa.', ['chave', 'extra'], 1);
    expect(segments).toEqual([
      { text: 'Use a ', keywordIndex: null },
      { text: 'chave', keywordIndex: 0 },
      { text: ' certa.', keywordIndex: null },
      { text: null, keywordIndex: 1 },
    ]);
  });
});
