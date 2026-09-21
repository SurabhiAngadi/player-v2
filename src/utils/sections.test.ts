import { describe, it, expect } from 'vitest';
import { hasAuthoredSection, expandsPerQuestion, sectionStepCount, sectionStepOrdinal } from './sections';
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
