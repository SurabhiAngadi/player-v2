import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerHeader } from './PlayerHeader';
import type { Section } from '../../types';

const mkSection = (id: string): Section => ({
  identifier: id,
  name: id,
  children: [],
  timeLimits: { max: 0, min: 0 },
  allowSkip: true,
  shuffle: false,
});

const baseProps = {
  brand: 'Sunbird',
  sections: [mkSection('a'), mkSection('b'), mkSection('c')],
  currentSectionIndex: 0,
  currentQuestionIndex: 0,
  completed: [false, false, false],
  answers: {},
  questionNumber: 1,
  totalQuestions: 9,
  onSubmit: vi.fn(),
};

describe('PlayerHeader', () => {
  it('renders brand, step indicators, counter and timer', () => {
    render(<PlayerHeader {...baseProps} timeRemaining={889} />);
    expect(screen.getByText('Sunbird')).toBeInTheDocument();
    expect(screen.getByText('1/9')).toBeInTheDocument();
    expect(screen.getByText('14:49')).toBeInTheDocument(); // mm:ss of 889
    const steps = screen.getAllByRole('listitem');
    expect(steps[0]).toHaveAttribute('aria-current', 'step');
  });

  it('hides the timer when no time remaining is given', () => {
    render(<PlayerHeader {...baseProps} timeRemaining={null} />);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('emits onSubmit', () => {
    const onSubmit = vi.fn();
    render(<PlayerHeader {...baseProps} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('emits onBrandClick when the brand is clicked', () => {
    const onBrandClick = vi.fn();
    render(<PlayerHeader {...baseProps} onBrandClick={onBrandClick} />);
    fireEvent.click(screen.getByRole('button', { name: /sunbird/i }));
    expect(onBrandClick).toHaveBeenCalledTimes(1);
  });

  // Mobile-app only (see PlayerHeader.module.scss .sectionLabel — hidden
  // outside m.compact); this just verifies MainPlayer's text reaches the DOM.
  it('renders sectionLabel when provided (section-intro stage only)', () => {
    render(<PlayerHeader {...baseProps} sectionLabel="Section A · 2 Questions" />);
    expect(screen.getByText('Section A · 2 Questions')).toBeInTheDocument();
  });

  it('omits sectionLabel when not provided', () => {
    render(<PlayerHeader {...baseProps} />);
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  const rootQuestions: Section = {
    ...mkSection('root'),
    isImplicitSection: true,
    children: [
      { identifier: 'rq1', name: 'test', body: '', primaryCategory: 'multiple choice question', maxScore: 1 },
      { identifier: 'rq2', name: 'maths', body: '', primaryCategory: 'multiple choice question', maxScore: 1 },
    ],
  };

  it('mixed layout: each root-level question gets its own step, continuing the same sequence as sections', () => {
    render(
      <PlayerHeader
        {...baseProps}
        sections={[mkSection('a'), rootQuestions, mkSection('b')]}
        completed={[false, false, false]}
      />,
    );
    // section a (1 step) + rootQuestions' 2 questions (1 step each) +
    // section b (1 step) = 4 steps total, lettered continuously A-D.
    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveTextContent('1'); // section a
    expect(steps[1]).toHaveTextContent('2'); // rq1 ("test")
    expect(steps[2]).toHaveTextContent('3'); // rq2 ("maths")
    expect(steps[3]).toHaveTextContent('4'); // section b
    expect(steps[1]).toHaveAttribute('title', 'test');
    expect(steps[2]).toHaveAttribute('title', 'maths');
  });

  // Expanding per-question exists so root-level questions can take their place
  // in the sequence ALONGSIDE real sections. A flat set has none to sit
  // alongside, so its single group stays one step — otherwise a 30-question
  // flat set would render 30 header dots for a set with no sections at all.
  it('fully flat layout: keeps the single group as one step', () => {
    render(
      <PlayerHeader
        {...baseProps}
        sections={[rootQuestions]}
        currentQuestionIndex={0}
        completed={[false]}
        answers={{ rq1: { value: 0 } }}
      />,
    );
    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(1);
    expect(steps[0]).toHaveTextContent('1');
  });

  // Regression guard for the mislabel this PR fixes: an implicit section's
  // `name` is the questionset's own name, so it must never be used as the
  // fallback title for an unnamed root-level question.
  it('titles an unnamed root-level question positionally, not after the questionset', () => {
    const unnamed: Section = {
      ...mkSection('root'),
      name: 'Qwert-test', // the questionset's own name
      isImplicitSection: true,
      children: [
        { identifier: 'rq1', body: '', primaryCategory: 'multiple choice question', maxScore: 1 },
      ],
    };
    render(
      <PlayerHeader {...baseProps} sections={[mkSection('a'), unnamed]} completed={[false, false]} />,
    );
    const steps = screen.getAllByRole('listitem');
    expect(steps[1]).toHaveAttribute('title', 'Question 1');
    expect(steps[1]).not.toHaveAttribute('title', 'Qwert-test');
  });
});
