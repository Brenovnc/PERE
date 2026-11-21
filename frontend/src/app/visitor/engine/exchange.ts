/**
 * Module import/export format, schemaVersion 1 (ModuleExchangeDtos.cs in the backend and
 * docs/module-exchange-v1.example.json). Visitors import it from a file or from the public
 * community endpoint, and the engine turns it into the content it studies.
 */

export interface ModuleDocument {
  schemaVersion: 1;
  module: {
    externalId: string;
    title: string;
    description: string | null;
    subject: string;
    version: number;
    crosswordEnabled: boolean;
    crosswordAllowAllWords: boolean;
    concepts: ConceptDocument[];
  };
}

export interface ConceptDocument {
  externalId: string;
  name: string;
  definition: string;
  isActive?: boolean;
  keywords: { value: string; isActive?: boolean }[];
  clues: { text: string; isActive?: boolean }[];
  prerequisites: string[];
  trueFalseActivities: {
    statement: string;
    isCorrect: boolean;
    explanation: string;
    isActive?: boolean;
  }[];
  fillBlankActivities: {
    text: string;
    answers: { slotNumber: number; correctText: string }[];
    distractors: string[];
    isActive?: boolean;
  }[];
  orderingActivities: { instruction: string; items: string[]; isActive?: boolean }[];
  crossword?: { word: string; clue: string } | null;
}

/** A concept as the engine sees it: only active content, with stable ids. */
export interface EngineConcept {
  id: string;
  name: string;
  definition: string;
  keywords: string[];
  clues: string[];
  prerequisites: string[];
  trueFalse: { id: string; statement: string; isCorrect: boolean; explanation: string }[];
  fillBlank: {
    id: string;
    text: string;
    answers: { slotNumber: number; correctText: string }[];
    distractors: string[];
  }[];
  ordering: { id: string; instruction: string; items: string[] }[];
  crossword: { word: string; clue: string } | null;
}

export interface ModuleContent {
  title: string;
  description: string | null;
  subject: string;
  crosswordEnabled: boolean;
  crosswordAllowAllWords: boolean;
  concepts: EngineConcept[];
}

/** The file is not a valid module; `details` lists what is wrong. */
export class ModuleImportError extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isList = (value: unknown): value is unknown[] => Array.isArray(value);
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Checks what the engine needs to work: required fields, unique concept ids, fill-in-the-blank
 * slots matching their answers, ordering with two or more items, existing prerequisites and no
 * prerequisite cycles. The length limits of the backend are not repeated here.
 */
export function parseModuleDocument(json: string): ModuleDocument {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ModuleImportError('O arquivo não é um JSON válido.');
  }
  if (!isObject(data) || data['schemaVersion'] !== 1 || !isObject(data['module']))
    throw new ModuleImportError(
      'Formato não reconhecido. Use um módulo exportado pelo PERE (schemaVersion 1).',
    );

  const errors: string[] = [];
  const module = data['module'];
  if (!isText(module['title'])) errors.push('module.title: obrigatório.');
  if (!isText(module['subject'])) errors.push('module.subject: obrigatório.');
  if (!isList(module['concepts'])) {
    errors.push('module.concepts: a lista de conceitos é obrigatória.');
    throw new ModuleImportError('O módulo tem erros.', errors);
  }

  const ids = new Set<string>();
  for (const [i, concept] of module['concepts'].entries()) {
    const path = `module.concepts[${i}]`;
    if (!isObject(concept)) {
      errors.push(`${path}: conceito inválido.`);
      continue;
    }
    const id = concept['externalId'];
    if (!isText(id)) errors.push(`${path}.externalId: obrigatório.`);
    else if (ids.has(id)) errors.push(`${path}.externalId: "${id}" repetido.`);
    else ids.add(id);
    if (!isText(concept['name'])) errors.push(`${path}.name: obrigatório.`);
    if (!isText(concept['definition'])) errors.push(`${path}.definition: obrigatória.`);
    for (const list of [
      'keywords',
      'clues',
      'prerequisites',
      'trueFalseActivities',
      'fillBlankActivities',
      'orderingActivities',
    ])
      if (!isList(concept[list])) errors.push(`${path}.${list}: a lista é obrigatória.`);
    if (isList(concept['fillBlankActivities']))
      concept['fillBlankActivities'].forEach((activity, j) => {
        const issue = fillBlankIssue(activity);
        if (issue) errors.push(`${path}.fillBlankActivities[${j}]: ${issue}`);
      });
    if (isList(concept['orderingActivities']))
      concept['orderingActivities'].forEach((activity, j) => {
        if (!isObject(activity) || !isText(activity['instruction']) || !isList(activity['items']))
          errors.push(`${path}.orderingActivities[${j}]: instrução e itens são obrigatórios.`);
        else if (activity['items'].filter(isText).length < 2)
          errors.push(`${path}.orderingActivities[${j}]: são necessários pelo menos dois itens.`);
      });
  }

  const concepts = module['concepts'].filter(isObject);
  for (const concept of concepts)
    if (isList(concept['prerequisites']))
      for (const prerequisite of concept['prerequisites'])
        if (typeof prerequisite !== 'string' || !ids.has(prerequisite))
          errors.push(
            `Pré-requisito "${String(prerequisite)}" de "${String(concept['externalId'])}" não existe.`,
          );
  if (errors.length === 0 && hasCycle(concepts as unknown as ConceptDocument[]))
    errors.push('Há um ciclo de pré-requisitos.');

  if (errors.length > 0) throw new ModuleImportError('O módulo tem erros.', errors);
  return data as unknown as ModuleDocument;
}

function fillBlankIssue(activity: unknown): string | null {
  if (!isObject(activity) || !isText(activity['text']) || !isList(activity['answers']))
    return 'texto e respostas são obrigatórios.';
  if (!isList(activity['distractors']) || activity['distractors'].filter(isText).length === 0)
    return 'é preciso pelo menos um distrator.';
  const slots = [
    ...new Set([...activity['text'].matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]))),
  ].sort((a, b) => a - b);
  const answers = activity['answers']
    .map((answer) => (isObject(answer) ? Number(answer['slotNumber']) : NaN))
    .sort((a, b) => a - b);
  const sequential = slots.every((slot, index) => slot === index + 1);
  const matches = slots.length === answers.length && slots.every((slot, i) => slot === answers[i]);
  return slots.length > 0 && sequential && matches
    ? null
    : 'as lacunas {{n}} e as respostas devem corresponder.';
}

function hasCycle(concepts: ConceptDocument[]): boolean {
  const edges = new Map(concepts.map((c) => [c.externalId, c.prerequisites]));
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 'done') return false;
    if (state.get(id) === 'visiting') return true;
    state.set(id, 'visiting');
    const cyclic = (edges.get(id) ?? []).some(visit);
    state.set(id, 'done');
    return cyclic;
  };
  return concepts.some((c) => visit(c.externalId));
}

const active = (item: { isActive?: boolean }) => item.isActive !== false;

/**
 * Active content only, like ModuleContentCache. Activity ids use the position in the file, so they
 * stay the same when the module is downloaded again.
 */
export function toModuleContent(document: ModuleDocument): ModuleContent {
  const { module } = document;
  return {
    title: module.title,
    description: module.description ?? null,
    subject: module.subject,
    crosswordEnabled: module.crosswordEnabled === true,
    crosswordAllowAllWords:
      module.crosswordEnabled === true && module.crosswordAllowAllWords === true,
    concepts: module.concepts.filter(active).map((concept) => {
      const id = concept.externalId;
      const indexed = <T extends { isActive?: boolean }>(items: T[]) =>
        items.map((item, index) => ({ item, index })).filter(({ item }) => active(item));
      return {
        id,
        name: concept.name,
        definition: concept.definition,
        keywords: concept.keywords.filter(active).map((k) => k.value),
        clues: concept.clues.filter(active).map((c) => c.text),
        prerequisites: concept.prerequisites,
        trueFalse: indexed(concept.trueFalseActivities).map(({ item, index }) => ({
          id: `${id}#tf${index}`,
          statement: item.statement,
          isCorrect: item.isCorrect,
          explanation: item.explanation,
        })),
        fillBlank: indexed(concept.fillBlankActivities).map(({ item, index }) => ({
          id: `${id}#fb${index}`,
          text: item.text,
          answers: item.answers,
          distractors: item.distractors,
        })),
        ordering: indexed(concept.orderingActivities).map(({ item, index }) => ({
          id: `${id}#or${index}`,
          instruction: item.instruction,
          items: item.items,
        })),
        crossword:
          concept.crossword?.word?.trim() && concept.crossword.clue?.trim()
            ? { word: concept.crossword.word, clue: concept.crossword.clue }
            : null,
      };
    }),
  };
}
