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

describe('MainPlayer overview — SECTIONS count with root-level questions', () => {
  it('counts each root-level question as its own section, not the whole implicit group as one', () => {
    render(
      <QumlProvider playerConfig={cfg}>
        <MainPlayer playerConfig={cfg} />
      </QumlProvider>,
    );
    // 1 real section (2 questions) + 2 root-level questions = 4 total questions,
    // 1 (section) + 2 (each root question) = 3 total "sections".
    // Buggy behavior (state.sections.length) would report 2 instead of 3.
    expect(screen.getByText('4')).toBeInTheDocument(); // QUESTIONS
    expect(screen.getByText('3')).toBeInTheDocument(); // SECTIONS
  });
});
