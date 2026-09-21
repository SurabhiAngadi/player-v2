import type { Section } from '../types';

/**
 * True when the questionset has at least one authored Section.
 *
 * Distinguishes a MIXED layout (real sections + questions at the root) from a
 * FLAT one (nothing but root-level questions).
 */
export function hasAuthoredSection(sections: Section[]): boolean {
  return sections.some((s) => !s.isImplicitSection);
}

/**
 * Whether a synthesized (implicit) group should be expanded into one entry per
 * question — for letters, step dots, overview cards and the section count.
 *
 * Expanding exists purely so root-level questions can take their place in the
 * A/B/C sequence *alongside* real sections. In a FLAT questionset there are no
 * real sections to sit alongside, so the one group stays one entry: expanding
 * it would report e.g. "SECTIONS 30" for a set that has no sections at all.
 */
export function expandsPerQuestion(section: Section, sections: Section[]): boolean {
  return Boolean(section.isImplicitSection) && hasAuthoredSection(sections);
}

/**
 * 1-based position of a question across the WHOLE assessment — question 7 of
 * 31, counting straight through every section.
 *
 * Derived from an explicit (sectionIndex, questionIndex) rather than current
 * state, so it can be computed for a question the player has not moved to yet.
 * A navigation handler runs before its own setCurrentSection/setCurrentQuestion
 * take effect, so reading the current position there would report the question
 * being left rather than the one being opened.
 */
export function globalQuestionNumber(
  sections: Section[],
  sectionIndex: number,
  questionIndex: number,
): number {
  const prior = sections
    .slice(0, Math.max(0, sectionIndex))
    .reduce((n, s) => n + s.children.length, 0);
  return prior + questionIndex + 1;
}

/**
 * Display label for a zero-based position in the section/question sequence.
 *
 * Numbered rather than lettered: the sequence now takes one place per
 * root-level question, not just per section, so it can run well past 26 —
 * where `String.fromCharCode(65 + n)` silently produces `[`, `\`, `]`, `^`…
 * Numbers have no such ceiling. Kept here as the single definition so the
 * badge, the step rail, the overview cards and the section intro cannot drift
 * apart. (Answer-option labels are a different sequence and stay lettered.)
 */
export function stepLabel(ordinal: number): string {
  return String(ordinal + 1);
}

/**
 * Total number of entries in the sequence — the value shown as the
 * "SECTIONS" stat, and the denominator in "Section 3 of 4".
 */
export function sectionStepCount(sections: Section[]): number {
  return sections.reduce(
    (n, s) => n + (expandsPerQuestion(s, sections) ? s.children.length : 1),
    0,
  );
}

/**
 * Zero-based position of `sections[sectionIndex]` within that same sequence.
 *
 * Not the raw array index: an implicit group expanded per-question occupies as
 * many places as it has questions, so a later section's letter is pushed along.
 * Using the array index instead would letter a section "C of 3" while the
 * header, sidebar and overview cards all call it "D of 4".
 */
export function sectionStepOrdinal(sections: Section[], sectionIndex: number): number {
  return sections
    .slice(0, Math.max(0, sectionIndex))
    .reduce((n, s) => n + (expandsPerQuestion(s, sections) ? s.children.length : 1), 0);
}
