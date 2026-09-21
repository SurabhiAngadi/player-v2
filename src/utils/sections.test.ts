import { describe, it, expect } from 'vitest';
import {
  hasAuthoredSection,
  expandsPerQuestion,
  globalQuestionNumber,
  sectionStepCount,
  sectionStepOrdinal,
  stepLabel,
} from './sections';
import type { Section } from '../types';

const q = (id: string) => ({
  identifier: id,
  body: '',
  primaryCategory: 'multiple choice question',
  maxScore: 1,
});

const section = (identifier: string, qs: string[], implicit = false): Section => ({
  identifier,
  name: identifier,
  isImplicitSection: implicit,
  children: qs.map(q),
  timeLimits: { max: 0, min: 0 },
  allowSkip: true,
  shuffle: false,
});

// [Section A, implicit(2 questions), Section B] — the sequence is
// A=SecA, B=loose1, C=loose2, D=SecB.
const mixed: Section[] = [
  section('SecA', ['a1']),
  section('root', ['loose1', 'loose2'], true),
  section('SecB', ['b1']),
];

// A flat set is a single implicit group and nothing else.
const flat: Section[] = [section('root', ['q1', 'q2', 'q3'], true)];

const sectioned: Section[] = [section('SecA', ['a1', 'a2']), section('SecB', ['b1'])];

describe('hasAuthoredSection', () => {
  it('distinguishes mixed/sectioned from flat', () => {
    expect(hasAuthoredSection(mixed)).toBe(true);
    expect(hasAuthoredSection(sectioned)).toBe(true);
    expect(hasAuthoredSection(flat)).toBe(false);
  });
});

describe('expandsPerQuestion', () => {
  it('expands an implicit group only when real sections exist to sit alongside', () => {
    expect(expandsPerQuestion(mixed[1], mixed)).toBe(true);
    expect(expandsPerQuestion(flat[0], flat)).toBe(false);
  });

  it('never expands a real section', () => {
    expect(expandsPerQuestion(mixed[0], mixed)).toBe(false);
    expect(expandsPerQuestion(sectioned[0], sectioned)).toBe(false);
  });
});

describe('sectionStepCount', () => {
  it('counts each root-level question separately only in a mixed layout', () => {
    expect(sectionStepCount(mixed)).toBe(4); // SecA + loose1 + loose2 + SecB
    expect(sectionStepCount(sectioned)).toBe(2);
    // NOT 3: a flat group has no real sections to sequence against, so
    // expanding it would report "SECTIONS 3" for a set with no sections.
    expect(sectionStepCount(flat)).toBe(1);
  });
});

describe('sectionStepOrdinal', () => {
  // The raw array index would put SecB at 2 → "C of 3", while the header,
  // sidebar and overview cards all call it "D of 4".
  it('accounts for the places an expanded group occupies', () => {
    expect(sectionStepOrdinal(mixed, 0)).toBe(0); // SecA  → A
    expect(sectionStepOrdinal(mixed, 2)).toBe(3); // SecB  → D, not C
  });

  it('matches the array index when nothing expands', () => {
    expect(sectionStepOrdinal(sectioned, 0)).toBe(0);
    expect(sectionStepOrdinal(sectioned, 1)).toBe(1);
    expect(sectionStepOrdinal(flat, 0)).toBe(0);
  });

  it('is defensive about out-of-range indices', () => {
    expect(sectionStepOrdinal(mixed, -1)).toBe(0);
  });
});

describe('stepLabel', () => {
  it('numbers from 1 and has no ceiling at 26', () => {
    expect(stepLabel(0)).toBe('1');
    // Lettering produced '[' here — String.fromCharCode(65 + 26).
    expect(stepLabel(26)).toBe('27');
    expect(stepLabel(99)).toBe('100');
  });
});

describe('globalQuestionNumber', () => {
  // mixed = [SecA(1q), implicit(2q), SecB(1q)] → 4 questions end to end.
  it('counts straight through every section', () => {
    expect(globalQuestionNumber(mixed, 0, 0)).toBe(1); // SecA q1
    expect(globalQuestionNumber(mixed, 1, 0)).toBe(2); // loose1
    expect(globalQuestionNumber(mixed, 1, 1)).toBe(3); // loose2
    expect(globalQuestionNumber(mixed, 2, 0)).toBe(4); // SecB q1
  });

  it('distinguishes questions within one section', () => {
    // The whole point: a section index alone reports the same value for all of
    // these, so per-question jumps become indistinguishable in telemetry.
    expect(globalQuestionNumber(flat, 0, 0)).toBe(1);
    expect(globalQuestionNumber(flat, 0, 1)).toBe(2);
    expect(globalQuestionNumber(flat, 0, 2)).toBe(3);
  });

  it('is defensive about out-of-range indices', () => {
    expect(globalQuestionNumber(mixed, -1, 0)).toBe(1);
  });
});
