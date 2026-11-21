import { Concept, ConceptInput, ModuleDetails, ModuleInput } from '../../../core/teacher.models';

export interface TrueFalseDraft {
  id?: string;
  statement: string;
  isCorrect: boolean;
  explanation: string;
}

/** Answers are typed as "1:DNS" lines and distractors one per line. */
export interface FillBlankDraft {
  id?: string;
  text: string;
  answers: string;
  distractors: string;
}

export interface OrderingDraft {
  id?: string;
  instruction: string;
  items: string;
}

/** Concept as edited in the form: lists that the teacher types one per line are kept as text. */
export interface ConceptDraft {
  id?: string;
  name: string;
  definition: string;
  keywords: string;
  clues: string;
  prerequisiteIds: string[];
  recognitionActivities: TrueFalseDraft[];
  fillBlankActivities: FillBlankDraft[];
  orderingActivities: OrderingDraft[];
  crosswordWord: string;
  crosswordClue: string;
}

export const blankModule = (): ModuleInput => ({
  title: '',
  description: '',
  subject: '',
  version: 1,
  crosswordEnabled: false,
  crosswordAllowAllWords: false,
});

export const blankConcept = (): ConceptDraft => ({
  name: '',
  definition: '',
  keywords: '',
  clues: '',
  prerequisiteIds: [],
  recognitionActivities: [],
  fillBlankActivities: [],
  orderingActivities: [],
  crosswordWord: '',
  crosswordClue: '',
});

export function lines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function moduleInputFrom(details: ModuleDetails): ModuleInput {
  return {
    title: details.title,
    description: details.description ?? '',
    subject: details.subject,
    version: details.version,
    crosswordEnabled: details.crosswordEnabled,
    crosswordAllowAllWords: details.crosswordAllowAllWords,
  };
}

/** Only active activities are edited; saving without the inactive ones keeps them inactive. */
export function draftFromConcept(concept: Concept): ConceptDraft {
  return {
    id: concept.id,
    name: concept.name,
    definition: concept.definition,
    keywords: concept.keywords.join('\n'),
    clues: concept.clues.join('\n'),
    prerequisiteIds: concept.prerequisiteIds,
    recognitionActivities: concept.recognitionActivities
      .filter((item) => item.isActive)
      .map(({ id, statement, isCorrect, explanation }) => ({
        id,
        statement,
        isCorrect,
        explanation,
      })),
    fillBlankActivities: concept.fillBlankActivities
      .filter((item) => item.isActive)
      .map((item) => ({
        id: item.id,
        text: item.text,
        answers: item.answers
          .map((answer) => `${answer.slotNumber}:${answer.correctText}`)
          .join('\n'),
        distractors: item.distractors.join('\n'),
      })),
    orderingActivities: concept.orderingActivities
      .filter((item) => item.isActive)
      .map((item) => ({
        id: item.id,
        instruction: item.instruction,
        items: item.items.join('\n'),
      })),
    crosswordWord: concept.crosswordWord ?? '',
    crosswordClue: concept.crosswordClue ?? '',
  };
}

export function toConceptInput(draft: ConceptDraft): ConceptInput {
  return {
    name: draft.name,
    definition: draft.definition,
    keywords: lines(draft.keywords),
    clues: lines(draft.clues),
    prerequisiteIds: draft.prerequisiteIds,
    recognitionActivities: draft.recognitionActivities,
    fillBlankActivities: draft.fillBlankActivities.map((item) => ({
      id: item.id,
      text: item.text,
      answers: lines(item.answers).map((line) => {
        const separator = line.indexOf(':');
        return {
          slotNumber: Number(line.slice(0, separator)),
          correctText: line.slice(separator + 1).trim(),
        };
      }),
      distractors: lines(item.distractors),
    })),
    orderingActivities: draft.orderingActivities.map((item) => ({
      id: item.id,
      instruction: item.instruction,
      items: lines(item.items),
    })),
    crosswordWord: draft.crosswordWord,
    crosswordClue: draft.crosswordClue,
  };
}
