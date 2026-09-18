import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StartPage } from './StartPage';
import type { Section } from '../../types';

const mkSection = (id: string, name: string, count: number, description: string): Section => ({
  identifier: id,
  name,
  description,
  children: Array.from({ length: count }, (_, i) => ({
    identifier: `${id}_q${i}`,
    body: '',
    primaryCategory: 'multiple choice question',
    maxScore: 1,
  })),
  timeLimits: { max: 0, min: 0 },
  allowSkip: true,
  shuffle: false,
});

const sections = [
  mkSection('a', 'Knowledge Check', 2, 'Recognise the right answer'),
  mkSection('b', 'Concepts & Recall', 1, 'Show what you remember'),
];

const baseProps = {
  title: 'Sunbird Assessment',
  sections,
  totalQuestions: 3,
  totalSections: 2,
  onStart: vi.fn(),
};

describe('StartPage', () => {
  it('renders title, the section list and the stats card', () => {
    render(<StartPage {...baseProps} timeLimit={900} attemptsLeft={3} />);
    expect(screen.getByRole('heading', { name: 'Sunbird Assessment' })).toBeInTheDocument();
    // The "assessment sections" grid lists the section names.
    expect(screen.getAllByText('Knowledge Check').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('15:00')).toBeInTheDocument(); // minutes stat
  });

  it('does not render the "progress is saved" pill', () => {
    render(<StartPage {...baseProps} />);
    expect(screen.queryByText(/progress is saved/i)).not.toBeInTheDocument();
  });

  it('shows "No Limit" for the minutes tile when there is no time limit', () => {
    render(<StartPage {...baseProps} timeLimit={0} attemptsLeft={3} />);
    expect(screen.getByText(/minutes/i)).toBeInTheDocument();
    expect(screen.getByText('No Limit')).toBeInTheDocument();
  });

  it('shows "No Limit" attempts when the backend does not send a cap', () => {
    render(<StartPage {...baseProps} attemptsLeft={null} />);
    expect(screen.getAllByText('No Limit').length).toBeGreaterThanOrEqual(1);
  });

  it('emits onStart when the CTA is clicked', () => {
    const onStart = vi.fn();
    render(<StartPage {...baseProps} onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: /start assessment/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('emits onSectionSelect from a section card', () => {
    const onSectionSelect = vi.fn();
    render(<StartPage {...baseProps} onSectionSelect={onSectionSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Concepts & Recall/i }));
    expect(onSectionSelect).toHaveBeenCalledWith(1);
  });

  describe('root-level questions (implicit section)', () => {
    const implicitSections: Section[] = [
      mkSection('a', 'qwert-section', 1, ''),
      {
        identifier: 'root-implicit',
        name: 'Qwert-test', // the questionset's own root name — must never render as a card label
        isImplicitSection: true,
        children: [
          { identifier: 'test', name: 'test', body: '', primaryCategory: 'multiple choice question', maxScore: 1 },
          { identifier: 'maths', name: 'maths', body: '', primaryCategory: 'multiple choice question', maxScore: 1 },
        ],
        timeLimits: { max: 0, min: 0 },
        allowSkip: true,
        shuffle: false,
      },
    ];

    it('gives each root-level question its own card instead of one lumped, mislabeled card', () => {
      render(
        <StartPage
          {...baseProps}
          sections={implicitSections}
          totalQuestions={3}
          totalSections={3}
        />,
      );
      // No card is ever labeled with the questionset's own root name.
      expect(screen.queryByText('Qwert-test')).not.toBeInTheDocument();
      // Each root-level question gets its own card, by its own title.
      expect(screen.getByText('test')).toBeInTheDocument();
      expect(screen.getByText('maths')).toBeInTheDocument();
      // Lettered continuously with the real section: A, B, C.
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
    });

    it('jumps straight to a root-level question via onQuestionSelect', () => {
      const onQuestionSelect = vi.fn();
      render(
        <StartPage
          {...baseProps}
          sections={implicitSections}
          totalQuestions={3}
          totalSections={3}
          onQuestionSelect={onQuestionSelect}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /maths/i }));
      expect(onQuestionSelect).toHaveBeenCalledWith(1, 1);
    });
  });
});
