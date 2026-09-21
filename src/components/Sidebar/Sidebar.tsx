import { useState } from 'react';
import { t, readI18n } from '../../i18n/translations';
import { isAnswered } from '../../utils/answered';
import { ChevronRightIcon } from '../icons';
import { expandsPerQuestion, stepLabel } from '../../utils/sections';
import type { Section, Question, AnswersMap } from '../../types';
import styles from './Sidebar.module.scss';

/**
 * Sidebar — persistent section/question navigator (Phase 6 design).
 *
 * Pure presentational `nav` landmark: a top-level lettered sequence (A, B,
 * C…) where each entry is either a real section card (name, blurb,
 * answered/total status, collapsible to reveal its own questions as
 * unlettered sub-items underneath) or — for a section synthesized to hold
 * root-level questions with no authored Section wrapper
 * (`section.isImplicitSection`) — one lettered row PER question, each a
 * sibling step in the same sequence as the section cards rather than a
 * child of one. The active section/question is highlighted. Status is
 * derived from Context-supplied props; jump intent is emitted via
 * `onSectionJump`/`onQuestionJump` (MainPlayer maps them to
 * setCurrentSection/setCurrentQuestion). The only local state is
 * expand/collapse — purely a view concern, no Context mutation.
 */
export interface SidebarProps {
  sections: Section[];
  currentSectionIndex: number;
  currentQuestionIndex: number;
  answers: AnswersMap;
  onSectionJump: (sectionIndex: number) => void;
  /** Jump straight to a specific question, in a specific (possibly different) section. */
  onQuestionJump: (sectionIndex: number, questionIndex: number) => void;
  language?: string;
}

function answeredCount(section: Section, answers: AnswersMap): number {
  return section.children.reduce((n, q) => (isAnswered(answers[q.identifier]) ? n + 1 : n), 0);
}

/** A question's short label: its own title if authored, else a positional fallback. */
function questionLabel(question: Question, qIndex: number, language: string): string {
  return question.name || `${t(language, 'QUESTION')} ${qIndex + 1}`;
}

/**
 * A question row. `letter` is only passed for a root-level (implicit-section)
 * question — it's a top-level step in its own right, so it gets the same
 * lettered badge a section card gets. A question nested under a real section
 * has no letter of its own (the section's single letter already covers it).
 */
function QuestionRow({
  question,
  qIndex,
  isActive,
  answered,
  className,
  activeClassName,
  answeredClassName,
  onClick,
  language,
  letter,
  showStatusDot,
}: {
  question: Question;
  qIndex: number;
  isActive: boolean;
  answered: boolean;
  className: string;
  activeClassName: string;
  answeredClassName: string;
  onClick: () => void;
  language: string;
  letter?: string;
  /**
   * A root-level question has no section grouping it into an aggregate
   * ●/○ count the way a real section's card already shows one — so it gets
   * its own single status dot instead: hollow while unanswered, filled in
   * the brand color once answered.
   */
  showStatusDot?: boolean;
}) {
  return (
    <li key={question.identifier}>
      <button
        type="button"
        className={[className, answered && answeredClassName, isActive && activeClassName]
          .filter(Boolean)
          .join(' ')}
        onClick={onClick}
        aria-current={isActive ? 'true' : undefined}
      >
        {letter && (
          <span
            className={`${styles.badge} ${isActive ? styles.badgeActive : ''}`.trim()}
            aria-hidden="true"
          >
            {letter}
          </span>
        )}
        <span className={styles.subName}>{questionLabel(question, qIndex, language)}</span>
        {showStatusDot && (
          <span
            className={`${styles.statusDot} ${answered ? styles.statusDotAnswered : ''}`.trim()}
            aria-label={t(language, answered ? 'ANSWERED' : 'UNANSWERED')}
          >
            {answered ? '●' : '○'}
          </span>
        )}
      </button>
    </li>
  );
}

export function Sidebar({
  sections,
  currentSectionIndex,
  currentQuestionIndex,
  answers,
  onSectionJump,
  onQuestionJump,
  language = 'en',
}: SidebarProps) {
  // Explicit per-section expand/collapse overrides. Absent an override, a
  // section defaults to expanded only while it's the active one — everything
  // else starts collapsed; the chevron lets the learner override either way.
  const [expandOverride, setExpandOverride] = useState<Record<string, boolean>>({});
  const toggleExpand = (identifier: string, currentlyExpanded: boolean) =>
    setExpandOverride((prev) => ({ ...prev, [identifier]: !currentlyExpanded }));

  let letterOrdinal = 0;

  return (
    <nav className={styles.sidebar} aria-label={t(language, 'NAVIGATION')}>
      <p className={styles.label}>{t(language, 'SECTIONS')}</p>

      <ul className={styles.list}>
        {sections.map((section, sectionIndex) => {
          // Implicit section (root-level questions, no authored Section wrapper):
          // no header, no collapse — each question is a top-level row rather
          // than a child of a section. Alongside real sections it also takes
          // its own place in the A/B/C… sequence; in a FLAT set there are no
          // real sections to sequence against, so the rows carry no letter.
          if (section.isImplicitSection) {
            const lettered = expandsPerQuestion(section, sections);
            return section.children.map((question, qIndex) => {
              const letter = lettered ? stepLabel(letterOrdinal) : undefined;
              if (lettered) letterOrdinal += 1;
              return (
                <QuestionRow
                  key={question.identifier}
                  question={question}
                  qIndex={qIndex}
                  isActive={sectionIndex === currentSectionIndex && qIndex === currentQuestionIndex}
                  answered={isAnswered(answers[question.identifier])}
                  className={styles.looseItem}
                  activeClassName={styles.looseItemActive}
                  answeredClassName={styles.looseItemAnswered}
                  onClick={() => onQuestionJump(sectionIndex, qIndex)}
                  language={language}
                  letter={letter}
                  showStatusDot
                />
              );
            });
          }

          const isActive = sectionIndex === currentSectionIndex;
          const isExpanded = expandOverride[section.identifier] ?? isActive;
          const total = section.children.length;
          const answered = answeredCount(section, answers);
          const blurb = readI18n(section.description, language);
          const name = readI18n(section.name, language);
          const letter = stepLabel(letterOrdinal);
          letterOrdinal += 1;

          return (
            <li key={section.identifier}>
              <div className={`${styles.card} ${isActive ? styles.active : ''}`.trim()}>
                <button
                  type="button"
                  className={styles.cardMain}
                  onClick={() => onSectionJump(sectionIndex)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span
                    className={`${styles.badge} ${isActive ? styles.badgeActive : ''}`.trim()}
                    aria-hidden="true"
                  >
                    {letter}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>{name}</span>
                    {blurb && <span className={styles.blurb}>{blurb}</span>}
                    <span className={styles.status}>
                      <span className={styles.answered} aria-label={`${t(language, 'ANSWERED')} ${answered}`}>
                        <span aria-hidden="true">● {answered}</span>
                      </span>
                      <span
                        className={styles.remaining}
                        aria-label={`${t(language, 'UNANSWERED')} ${total - answered}`}
                      >
                        <span aria-hidden="true">○ {total - answered}</span>
                      </span>
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.expandToggle}
                  onClick={() => toggleExpand(section.identifier, isExpanded)}
                  aria-expanded={isExpanded}
                  aria-label={
                    isExpanded ? t(language, 'COLLAPSE_SECTION') : t(language, 'EXPAND_SECTION')
                  }
                >
                  <ChevronRightIcon
                    size={18}
                    className={`${styles.expandIcon} ${isExpanded ? styles.expandIconOpen : ''}`.trim()}
                  />
                </button>
              </div>

              {isExpanded && (
                <ul className={styles.subList}>
                  {section.children.map((question, qIndex) => (
                    <QuestionRow
                      key={question.identifier}
                      question={question}
                      qIndex={qIndex}
                      isActive={sectionIndex === currentSectionIndex && qIndex === currentQuestionIndex}
                      answered={isAnswered(answers[question.identifier])}
                      className={styles.subItem}
                      activeClassName={styles.subItemActive}
                      answeredClassName={styles.subItemAnswered}
                      onClick={() => onQuestionJump(sectionIndex, qIndex)}
                      language={language}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
