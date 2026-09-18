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
    expect(steps[0]).toHaveTextContent('A'); // section a
    expect(steps[1]).toHaveTextContent('B'); // rq1 ("test")
    expect(steps[2]).toHaveTextContent('C'); // rq2 ("maths")
    expect(steps[3]).toHaveTextContent('D'); // section b
    expect(steps[1]).toHaveAttribute('title', 'test');
    expect(steps[2]).toHaveAttribute('title', 'maths');
  });

  it('fully flat layout: gives each root-level question its own step when no real section exists', () => {
    render(
      <PlayerHeader
        {...baseProps}
        sections={[rootQuestions]}
        currentQuestionIndex={0}
        completed={[false]}
        answers={{ rq1: { value: 0 } }}
      />,
    );
    // No real section at all → one step per question.
    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(2);
    expect(steps[0]).toHaveTextContent('A');
    expect(steps[1]).toHaveTextContent('B');
    expect(steps[0]).toHaveAttribute('title', 'test');
    expect(steps[1]).toHaveAttribute('title', 'maths');
  });
});
