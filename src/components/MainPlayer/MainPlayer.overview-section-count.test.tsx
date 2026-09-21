import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QumlProvider } from '../../context/QumlContext';
import { MainPlayer } from './MainPlayer';
import type { PlayerConfig } from '../../types';

// Mixed layout: one real, authored section (2 questions) + 2 root-level
// questions with no Section wrapper at all — same shape as the "qwert-test"
// content found during mobile testing (1 section + "test" + "maths").
const metadata = {
  identifier: 'do_mixed_overview',
  name: 'Mixed overview set',
  objectType: 'QuestionSetImage',
  timeLimits: { questionSet: { max: 0, min: 0 } },
  children: [
    {
      identifier: 'do_secA',
      name: 'Section A',
      objectType: 'QuestionSet',
      index: 1,
      children: [
        {
          identifier: 'do_q1',
          name: 'Q1',
          objectType: 'Question',
          primaryCategory: 'Multiple Choice Question',
          qType: 'MCQ',
          index: 1,
          maxScore: 1,
          body: '<p>Q1</p>',
          interactions: { response1: { type: 'choice', options: [{ label: { en: 'a' }, value: 0 }] } },
          responseDeclaration: {
            response1: { cardinality: 'single', type: 'integer', correctResponse: { value: 0 } },
          },
        },
        {
          identifier: 'do_q2',
          name: 'Q2',
          objectType: 'Question',
          primaryCategory: 'Multiple Choice Question',
          qType: 'MCQ',
          index: 2,
          maxScore: 1,
          body: '<p>Q2</p>',
          interactions: { response1: { type: 'choice', options: [{ label: { en: 'a' }, value: 0 }] } },
          responseDeclaration: {
            response1: { cardinality: 'single', type: 'integer', correctResponse: { value: 0 } },
          },
        },
      ],
    },
    {
      identifier: 'do_test',
      name: 'test',
      objectType: 'Question',
      primaryCategory: 'Multiple Choice Question',
      qType: 'MCQ',
      index: 1,
      maxScore: 1,
      body: '<p>Root question 1</p>',
      interactions: { response1: { type: 'choice', options: [{ label: { en: 'a' }, value: 0 }] } },
      responseDeclaration: {
        response1: { cardinality: 'single', type: 'integer', correctResponse: { value: 0 } },
      },
    },
    {
      identifier: 'do_maths',
      name: 'maths',
      objectType: 'Question',
      primaryCategory: 'Multiple Choice Question',
      qType: 'MCQ',
      index: 2,
      maxScore: 1,
      body: '<p>Root question 2</p>',
      interactions: { response1: { type: 'choice', options: [{ label: { en: 'a' }, value: 0 }] } },
      responseDeclaration: {
        response1: { cardinality: 'single', type: 'integer', correctResponse: { value: 0 } },
      },
    },
  ],
};

const cfg: PlayerConfig = { context: {}, config: { language: 'en' }, metadata, data: {} };

/** Read a stat tile's value by its label, e.g. stat(container, 'sections'). */
function stat(container: HTMLElement, label: string): string | undefined {
  const dts = Array.from(container.querySelectorAll('dt')).map((e) => e.textContent?.toLowerCase());
  const dds = Array.from(container.querySelectorAll('dd')).map((e) => e.textContent ?? undefined);
  return dds[dts.indexOf(label)];
}

describe('MainPlayer overview — SECTIONS count with root-level questions', () => {
  it('counts each root-level question as its own section, not the whole implicit group as one', () => {
    const { container } = render(
      <QumlProvider playerConfig={cfg}>
        <MainPlayer playerConfig={cfg} />
      </QumlProvider>,
    );
    // 1 real section (2 questions) + 2 root-level questions = 4 total questions,
    // 1 (section) + 2 (each root question) = 3 total "sections".
    // Buggy behavior (state.sections.length) would report 2 instead of 3.
    // Read via the stat label: sequence badges are numbers too, so a bare
    // getByText('3') matches the badge as well as the tile.
    expect(stat(container, 'questions')).toBe('4');
    expect(stat(container, 'sections')).toBe('3');
  });

  // A FLAT questionset has no authored sections at all, so there is nothing for
  // root-level questions to sit alongside — the single synthesized group must
  // stay ONE entry. Expanding it per-question would report "SECTIONS 30" for a
  // questionset that has no sections whatsoever.
  it('does not expand a fully-flat questionset into one section per question', () => {
    const flat = {
      identifier: 'do_flat',
      name: 'Flat set',
      objectType: 'QuestionSetImage',
      timeLimits: { questionSet: { max: 0, min: 0 } },
      children: Array.from({ length: 30 }, (_, i) => ({
        identifier: `do_q${i + 1}`,
        name: `Q${i + 1}`,
        objectType: 'Question',
        primaryCategory: 'Multiple Choice Question',
        qType: 'MCQ',
        index: i + 1,
        maxScore: 1,
        body: `<p>Q${i + 1}</p>`,
        interactions: { response1: { type: 'choice', options: [{ label: { en: 'a' }, value: 0 }] } },
        responseDeclaration: {
          response1: { cardinality: 'single', type: 'integer', correctResponse: { value: 0 } },
        },
      })),
    };
    const flatCfg: PlayerConfig = { context: {}, config: { language: 'en' }, metadata: flat, data: {} };
    const { container } = render(
      <QumlProvider playerConfig={flatCfg}>
        <MainPlayer playerConfig={flatCfg} />
      </QumlProvider>,
    );

    expect(stat(container, 'questions')).toBe('30');
    expect(stat(container, 'sections')).toBe('1');
    // ...and one overview card, not thirty.
    expect(container.querySelectorAll('[class*="sectionCard"]')).toHaveLength(1);
  });
});
