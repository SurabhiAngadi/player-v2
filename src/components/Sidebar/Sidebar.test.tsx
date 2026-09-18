import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import type { Section } from '../../types';

const sections: Section[] = [
  {
    identifier: 's1',
    name: 'Section One',
    description: 'Recognise the right answer',
    children: [
      { identifier: 'q1', body: '', primaryCategory: 'multiple choice question', maxScore: 1 },
      { identifier: 'q2', body: '', primaryCategory: 'multiple choice question', maxScore: 1 },
    ],
    timeLimits: { max: 0, min: 0 },
    allowSkip: true,
    shuffle: false,
  },
  {
    identifier: 's2',
    name: 'Section Two',
    description: 'Show what you remember',
    children: [
      { identifier: 'q3', name: 'Q3', body: '', primaryCategory: 'multiple choice question', maxScore: 1 },
    ],
    timeLimits: { max: 0, min: 0 },
    allowSkip: true,
    shuffle: false,
  },
];

const implicitSections: Section[] = [
  {
    identifier: 'root-implicit',
    name: 'Qwert-test',
    isImplicitSection: true,
    children: [
      { identifier: 'rq1', name: 'Root question', body: '', primaryCategory: 'multiple choice question', maxScore: 1 },
    ],
    timeLimits: { max: 0, min: 0 },
    allowSkip: true,
    shuffle: false,
  },
  {
    identifier: 's1',
    name: 'Section One',
    children: [
      { identifier: 'q1', body: '', primaryCategory: 'multiple choice question', maxScore: 1 },
    ],
    timeLimits: { max: 0, min: 0 },
    allowSkip: true,
    shuffle: false,
  },
];

describe('Sidebar', () => {
  it('is a nav landmark listing sections with answered/total status', () => {
    render(
      <Sidebar
        sections={sections}
        currentSectionIndex={0}
        currentQuestionIndex={0}
        answers={{ q1: { value: 0 } }}
        onSectionJump={vi.fn()}
        onQuestionJump={vi.fn()}
      />,
    );
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByText('Section One')).toBeInTheDocument();
    expect(screen.getByText('Recognise the right answer')).toBeInTheDocument();
    // Section One: 1 answered of 2 → 1 remaining. Section Two: 0 of 1 → 1 remaining.
    expect(screen.getByText('● 1')).toBeInTheDocument();
    expect(screen.getByText('● 0')).toBeInTheDocument();
    expect(screen.getAllByText('○ 1')).toHaveLength(2);
    // Active section exposed to AT.
    expect(screen.getByRole('button', { name: /Section One/i })).toHaveAttribute('aria-current', 'true');
  });

  it('emits a section jump', () => {
    const onSectionJump = vi.fn();
    render(
      <Sidebar
        sections={sections}
        currentSectionIndex={0}
        currentQuestionIndex={0}
        answers={{}}
        onSectionJump={onSectionJump}
        onQuestionJump={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Section Two/i }));
    expect(onSectionJump).toHaveBeenCalledWith(1);
  });

  it('lists a section\'s own questions as indented sub-items and jumps straight to one', () => {
    const onQuestionJump = vi.fn();
    render(
      <Sidebar
        sections={sections}
        currentSectionIndex={0}
        currentQuestionIndex={0}
        answers={{}}
        onSectionJump={vi.fn()}
        onQuestionJump={onQuestionJump}
      />,
    );
    // Section One has 2 questions, neither named → positional fallback labels.
    fireEvent.click(screen.getByRole('button', { name: /Question 2/i }));
    expect(onQuestionJump).toHaveBeenCalledWith(0, 1);
  });

  it('renders an implicit section\'s questions as flat items, each with its own letter continuing the section sequence', () => {
    render(
      <Sidebar
        sections={implicitSections}
        currentSectionIndex={0}
        currentQuestionIndex={0}
        answers={{}}
        onSectionJump={vi.fn()}
        onQuestionJump={vi.fn()}
      />,
    );
    // No header for the implicit section — its own name never renders.
    expect(screen.queryByText('Qwert-test')).not.toBeInTheDocument();
    // Its question renders as a flat item, by its own title.
    expect(screen.getByText('Root question')).toBeInTheDocument();
    // implicitSections = [implicit (1 question), real section] — the loose
    // question is the first top-level step (A), so the real section that
    // follows it is B, not A.
    expect(screen.getByText('A')).toBeInTheDocument(); // the loose question's badge
    expect(screen.getByText('B')).toBeInTheDocument(); // the real section's badge
  });

  it('jumps straight to a loose (implicit-section) question', () => {
    const onQuestionJump = vi.fn();
    render(
      <Sidebar
        sections={implicitSections}
        currentSectionIndex={0}
        currentQuestionIndex={0}
        answers={{}}
        onSectionJump={vi.fn()}
        onQuestionJump={onQuestionJump}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Root question/i }));
    expect(onQuestionJump).toHaveBeenCalledWith(0, 0);
  });

  it('shows a hollow status dot on an unanswered loose question, filled once answered', () => {
    const { rerender } = render(
      <Sidebar
        sections={implicitSections}
        currentSectionIndex={0}
        currentQuestionIndex={0}
        answers={{}}
        onSectionJump={vi.fn()}
        onQuestionJump={vi.fn()}
      />,
    );
    const loose = screen.getByRole('button', { name: /Root question/i });
    expect(loose).toHaveTextContent('○');
    expect(loose.querySelector('.icon-question-mark')).toBeNull();

    rerender(
      <Sidebar
        sections={implicitSections}
        currentSectionIndex={0}
        currentQuestionIndex={0}
        answers={{ rq1: { value: 0 } }}
        onSectionJump={vi.fn()}
        onQuestionJump={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Root question/i })).toHaveTextContent('●');
  });

  it('does not show a status dot on a question nested under a real section (the section already shows an aggregate count)', () => {
    render(
      <Sidebar
        sections={sections}
        currentSectionIndex={0}
        currentQuestionIndex={0}
        answers={{}}
        onSectionJump={vi.fn()}
        onQuestionJump={vi.fn()}
      />,
    );
    const subItem = screen.getByRole('button', { name: /Question 2/i });
    expect(subItem).not.toHaveTextContent('○');
    expect(subItem).not.toHaveTextContent('●');
  });

  it('a non-active section starts collapsed; the chevron expands and re-collapses it', () => {
    render(
      <Sidebar
        sections={sections}
        currentSectionIndex={0}
        currentQuestionIndex={0}
        answers={{}}
        onSectionJump={vi.fn()}
        onQuestionJump={vi.fn()}
      />,
    );
    // Section Two isn't active → collapsed by default, its question hidden.
    expect(screen.queryByRole('button', { name: /Q3/i })).not.toBeInTheDocument();

    // Section One (active) is already expanded, so its own toggle also reads
    // "Collapse section" — grab Section Two's specific toggle by its
    // starting label instead of re-querying by the (now ambiguous) label
    // after it flips.
    const toggle = screen.getByRole('button', { name: /expand section/i });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /Q3/i })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByRole('button', { name: /Q3/i })).not.toBeInTheDocument();
  });

  it('the active section is expanded by default, with no chevron interaction needed', () => {
    render(
      <Sidebar
        sections={sections}
        currentSectionIndex={0}
        currentQuestionIndex={0}
        answers={{}}
        onSectionJump={vi.fn()}
        onQuestionJump={vi.fn()}
      />,
    );
    // Section One (active) already shows its questions.
    expect(screen.getByRole('button', { name: /Question 2/i })).toBeInTheDocument();
  });

  it('renders no icon or position number on a question nested under a real section', () => {
    const { container } = render(
      <Sidebar
        sections={sections}
        currentSectionIndex={0}
        currentQuestionIndex={0}
        answers={{ q1: { value: 0 } }}
        onSectionJump={vi.fn()}
        onQuestionJump={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('.icon-question-mark')).toHaveLength(0);
    // Nested sub-items have no letter badge of their own — only the plain label.
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });
});
