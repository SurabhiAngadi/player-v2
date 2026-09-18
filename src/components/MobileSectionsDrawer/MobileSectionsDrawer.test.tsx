import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileSectionsDrawer } from './MobileSectionsDrawer';
import type { Section } from '../../types';

const sections: Section[] = [
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

const baseProps = {
  sections,
  currentSectionIndex: 0,
  currentQuestionIndex: 0,
  answers: {},
  onSectionJump: vi.fn(),
  onQuestionJump: vi.fn(),
};

describe('MobileSectionsDrawer', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <MobileSectionsDrawer {...baseProps} isOpen={false} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a modal dialog when open', () => {
    render(<MobileSectionsDrawer {...baseProps} isOpen onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<MobileSectionsDrawer {...baseProps} isOpen onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes after a section jump', () => {
    const onClose = vi.fn();
    const onSectionJump = vi.fn();
    render(
      <MobileSectionsDrawer
        {...baseProps}
        onSectionJump={onSectionJump}
        isOpen
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Section One/i }));
    expect(onSectionJump).toHaveBeenCalledWith(0);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes after a question jump', () => {
    const onClose = vi.fn();
    const onQuestionJump = vi.fn();
    render(
      <MobileSectionsDrawer
        {...baseProps}
        onQuestionJump={onQuestionJump}
        isOpen
        onClose={onClose}
      />,
    );
    // Section One has 1 question, unnamed → positional fallback "Question 1".
    fireEvent.click(screen.getByRole('button', { name: /Question 1/i }));
    expect(onQuestionJump).toHaveBeenCalledWith(0, 0);
    expect(onClose).toHaveBeenCalled();
  });
});
