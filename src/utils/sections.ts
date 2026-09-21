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
 * Total number of entries in the A/B/C… sequence — the value shown as the
 * "SECTIONS" stat, and the denominator in "Section C of 4".
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
