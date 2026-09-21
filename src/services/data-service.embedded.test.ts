import { describe, it, expect } from 'vitest';
import { hasEmbeddedQuestions, transformEmbeddedQuestionSet } from './data-service';

// Real metadata (trimmed) the editor/portal pass as playerConfig.metadata:
// the WHOLE questionset with question content embedded in the hierarchy —
// Section A [Q1 MCQ, Q2 SA], Section B [Q3 FTB, Q5 REO].
const metadata = {
  identifier: 'do_214609811633471488164',
  name: 'Sample question set',
  objectType: 'QuestionSetImage',
  timeLimits: { questionSet: { max: 0, min: 0 } },
  children: [
    {
      identifier: 'do_214609815842570240180',
      name: 'Section A',
      objectType: 'QuestionSet',
      index: 1,
      children: [
        {
          identifier: 'do_214609815842586624182',
          name: 'Q1',
          objectType: 'Question',
          primaryCategory: 'Multiple Choice Question',
          qType: 'MCQ',
          index: 1,
          maxScore: 5,
          body: '<div class="mcq-title">Which is the capital of France?</div>',
          interactions: {
            response1: {
              type: 'choice',
              options: [
                { label: { en: 'New York' }, value: 0 },
                { label: { en: 'Paris' }, value: 1 },
              ],
            },
          },
          responseDeclaration: {
            response1: { cardinality: 'single', type: 'integer', correctResponse: { value: 1 } },
          },
        },
        {
          identifier: 'do_2146098163851018241112',
          name: 'Q2',
          objectType: 'Question',
          primaryCategory: 'Subjective Question',
          qType: 'SA',
          index: 2,
          maxScore: 5,
          body: 'When is Independence Day observed in India',
          interactions: {},
          answer: '<div class="answer-body">15th August</div>',
        },
      ],
    },
    {
      identifier: 'do_21460983368164147213',
      name: 'Section B',
      objectType: 'QuestionSet',
      index: 2,
      children: [
        {
          identifier: 'do_21460983367935590411',
          name: 'Q3',
          objectType: 'Question',
          primaryCategory: 'FTB Question',
          qType: 'FTB',
          index: 1,
          maxScore: 1,
          body: 'The tree is [[response1]]',
          interactions: { response1: { type: 'text' } },
          responseProcessing: { template: 'MAP_RESPONSE' },
          evalUnordered: true,
          responseDeclaration: {
            response1: {
              cardinality: 'single',
              type: 'string',
              correctResponse: { value: 'tall' },
              mapping: [{ value: 'tall', score: 1, caseSensitive: false }],
            },
          },
        },
        {
          identifier: 'do_21460983413725593617',
          name: 'Q5',
          objectType: 'Question',
          primaryCategory: 'Reorder Question',
          qType: 'REO',
          index: 2,
          maxScore: 1,
          body: '<div class="order-title">Reorder the sentence</div>',
          interactions: {
            response1: {
              type: 'order',
              options: [
                { value: 'A', label: 'Book' },
                { value: 'B', label: 'is' },
              ],
            },
          },
          responseProcessing: { template: 'MATCH_CORRECT' },
        },
      ],
    },
  ],
};

describe('embedded questionset metadata (editor/portal contract)', () => {
  it('detects embedded question content', () => {
    expect(hasEmbeddedQuestions(metadata)).toBe(true);
  });

  it('does NOT flag a stub-only hierarchy as embedded', () => {
    const stubHierarchy = {
      identifier: 'do_x',
      children: [
        {
          identifier: 'sec',
          objectType: 'QuestionSet',
          children: [{ identifier: 'q', objectType: 'Question', qType: 'MCQ' }], // no body/interactions
        },
      ],
    };
    expect(hasEmbeddedQuestions(stubHierarchy)).toBe(false);
  });

  it('builds 2 sections with the 4 embedded questions (no fetch)', () => {
    const sections = transformEmbeddedQuestionSet(metadata);
    expect(sections).toHaveLength(2);
    expect(sections[0].children.map((q) => q.qType)).toEqual(['MCQ', 'SA']);
    expect(sections[1].children.map((q) => q.qType)).toEqual(['FTB', 'REO']);
    // content survived the transform
    expect(sections[0].children[0].body).toContain('capital of France');
    expect(sections[1].children[0].body).toContain('[[response1]]');
    // scoring hints preserved for FTB
    expect(sections[1].children[0].responseProcessing?.template).toBe('MAP_RESPONSE');
    expect(sections[1].children[0].evalUnordered).toBe(true);
    // real, authored sections are never flagged implicit
    expect(sections[0].isImplicitSection).toBeFalsy();
    expect(sections[1].isImplicitSection).toBeFalsy();
  });
});

describe('flat and mixed root layouts', () => {
  const question = (id: string, index: number) => ({
    identifier: id,
    name: id,
    objectType: 'Question',
    primaryCategory: 'Multiple Choice Question',
    qType: 'MCQ',
    index,
    maxScore: 1,
    body: `<div>${id}</div>`,
    interactions: { response1: { type: 'choice', options: [{ label: { en: 'a' }, value: 0 }] } },
    responseDeclaration: {
      response1: { cardinality: 'single', type: 'integer', correctResponse: { value: 0 } },
    },
  });

  it('fully flat root (all questions, no sections) wraps as one implicit section', () => {
    const flat = {
      identifier: 'do_flat',
      name: 'Flat set',
      objectType: 'QuestionSet',
      children: [question('q2', 2), question('q1', 1)],
    };
    const sections = transformEmbeddedQuestionSet(flat);
    expect(sections).toHaveLength(1);
    expect(sections[0].isImplicitSection).toBe(true);
    // ordered by stub `index`, not hierarchy order
    expect(sections[0].children.map((q) => q.identifier)).toEqual(['q1', 'q2']);
  });

  it('mixed layout (loose questions + real sections) preserves hierarchy order and drops nothing', () => {
    const realSection = {
      identifier: 'do_section',
      name: 'Section A',
      objectType: 'QuestionSet',
      children: [question('q2', 1)],
    };
    const mixed = {
      identifier: 'do_mixed',
      name: 'Mixed set',
      objectType: 'QuestionSet',
      children: [question('q1', 1), realSection, question('q3', 1)],
    };
    const sections = transformEmbeddedQuestionSet(mixed);
    expect(sections).toHaveLength(3);
    expect(sections[0].isImplicitSection).toBe(true);
    expect(sections[0].children.map((q) => q.identifier)).toEqual(['q1']);
    expect(sections[1].isImplicitSection).toBeFalsy();
    expect(sections[1].children.map((q) => q.identifier)).toEqual(['q2']);
    expect(sections[2].isImplicitSection).toBe(true);
    expect(sections[2].children.map((q) => q.identifier)).toEqual(['q3']);
    // no question dropped across the whole set
    expect(sections.flatMap((s) => s.children.map((q) => q.identifier)).sort()).toEqual([
      'q1',
      'q2',
      'q3',
    ]);
  });

  it('gives a synthesized group the questionset\'s own identifier, not a fabricated one', () => {
    // The id does not stay internal: it becomes MediaResolveContext.sectionId,
    // which utils/media.ts uses to build offline asset paths
    // ({basePath}/{sectionId}/{questionId}/{src}), and is reported as sectionId
    // on RESPONSE/ASSESS telemetry. A fabricated "<root>_implicit_0" would point
    // downloaded content at a directory that does not exist (images silently
    // fail) and put non-existent ids into analytics.
    const mixed = {
      identifier: 'do_mixed',
      name: 'Mixed set',
      objectType: 'QuestionSet',
      children: [
        question('q1', 1),
        { identifier: 'do_section', name: 'Section A', objectType: 'QuestionSet', children: [question('q2', 1)] },
        question('q3', 1),
      ],
    };
    const sections = transformEmbeddedQuestionSet(mixed);
    const implicit = sections.filter((s) => s.isImplicitSection);
    expect(implicit).toHaveLength(2);
    for (const s of implicit) {
      expect(s.identifier).toBe('do_mixed');
      expect(s.identifier).not.toMatch(/_implicit_/);
    }
  });
});
