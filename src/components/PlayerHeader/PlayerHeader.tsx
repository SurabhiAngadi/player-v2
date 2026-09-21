import { useEffect, useRef, useState } from 'react';
import { t, readI18n } from '../../i18n/translations';
import { TimerIcon, MenuIcon } from '../icons';
import { isAnswered } from '../../utils/answered';
import { expandsPerQuestion, stepLabel } from '../../utils/sections';
import type { Section, AnswersMap } from '../../types';
import styles from './PlayerHeader.module.scss';

/**
 * PlayerHeader — persistent assessment shell header (Phase 6 design).
 *
 * Pure presentational: brand + section step indicators (left) and timer, help,
 * global question counter, and Submit (right). All data is supplied by MainPlayer
 * from Context; intent is emitted via callbacks. No Context mutation.
 */
export interface PlayerHeaderProps {
  brand: string;
  sections: Section[];
  currentSectionIndex: number;
  currentQuestionIndex: number;
  completed: boolean[];
  /**
   * Drives the per-question step status for root-level questions (a section
   * synthesized to hold questions with no authored Section wrapper —
   * `section.isImplicitSection` — contributes one step per question instead
   * of one step for the whole group; real sections still contribute one).
   */
  answers: AnswersMap;
  /** Seconds remaining (countdown mode); null/omitted hides the countdown. */
  timeRemaining?: number | null;
  /**
   * Seconds elapsed (count-up mode — Angular header showCountUp parity, shown
   * when there is no time limit). Ignored while a countdown is active.
   */
  timeElapsed?: number | null;
  questionNumber: number;
  totalQuestions: number;
  onSubmit: () => void;
  /**
   * Entry point into the (editable, pre-submit) review screen — independent
   * of whether the Submit button shows a confirmation dialog. Omit to hide
   * the button entirely.
   */
  onReview?: () => void;
  /**
   * Review is only actionable on the last question of the last section; the
   * button stays visible everywhere so it's discoverable, but is disabled
   * (with a tooltip) until then. Defaults to true (enabled) when omitted.
   */
  reviewAvailable?: boolean;
  onMenuClick?: () => void;
  /** Click the brand to return to the overview / start page. */
  onBrandClick?: () => void;
  /**
   * Mobile-app only (see `.sectionLabel` — hidden outside `m.compact`) — e.g.
   * "Section A · 2 Questions", shown in place of the section-intro screen's
   * banner (removed there in compact mode). Omit outside the section-intro
   * stage.
   */
  sectionLabel?: string;
  language?: string;
}

function formatMmSs(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function PlayerHeader({
  brand,
  sections,
  currentSectionIndex,
  currentQuestionIndex,
  completed,
  answers,
  timeRemaining = null,
  timeElapsed = null,
  questionNumber,
  totalQuestions,
  onSubmit,
  onReview,
  reviewAvailable = true,
  onMenuClick,
  onBrandClick,
  sectionLabel,
  language = 'en',
}: PlayerHeaderProps) {
  // Countdown takes precedence; count-up shows when there is no time limit.
  const showCountdown = timeRemaining != null;
  const showTimer = showCountdown || timeElapsed != null;
  const isTimeLow = showCountdown && timeRemaining <= 60;
  const [showLegend, setShowLegend] = useState(false);

  // The rail scrolls with its scrollbar hidden, so keep the active step in
  // view as the learner advances — otherwise progressing past the visible
  // range would leave the current position off-screen with no obvious way
  // back to it. `block: 'nearest'` so this never scrolls the page itself.
  const activeStepRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    const el = activeStepRef.current;
    // jsdom (tests) doesn't implement scrollIntoView.
    if (typeof el?.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }, [currentSectionIndex, currentQuestionIndex, sections]);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {onMenuClick && (
          <button
            type="button"
            className={styles.menuBtn}
            onClick={onMenuClick}
            aria-label={t(language, 'OPEN_MENU')}
          >
            <MenuIcon size={20} />
          </button>
        )}

        <button
          type="button"
          className={styles.brand}
          onClick={onBrandClick}
          aria-label={`${brand} — ${t(language, 'ASSESSMENT_OVERVIEW')}`}
        >
          <span className={styles.brandBadge} aria-hidden="true">
            {brand.charAt(0).toUpperCase()}
          </span>
          <span className={styles.brandName}>{brand}</span>
        </button>

        {sectionLabel && <span className={styles.sectionLabel}>{sectionLabel}</span>}

        <ol className={styles.steps} aria-label={t(language, 'SECTIONS')}>
          {(() => {
            // A real, authored section contributes one step. A section
            // synthesized to hold root-level questions isn't a section at
            // all — alongside real sections each of its questions becomes its
            // own step, a sibling in the same A/B/C… sequence as section
            // cards (same as the Sidebar). A FLAT set has no real sections to
            // sit alongside, so its single group stays one step.
            type Step = { key: string; title: string; active: boolean; completed: boolean };
            const steps: Step[] = [];

            sections.forEach((section, sectionIndex) => {
              if (expandsPerQuestion(section, sections)) {
                section.children.forEach((question, questionIndex) => {
                  steps.push({
                    key: question.identifier,
                    // Never fall back to the implicit section's own name: it
                    // is the questionset's name, so an unnamed question would
                    // be titled after the whole assessment.
                    title: question.name || `${t(language, 'QUESTION')} ${questionIndex + 1}`,
                    active: sectionIndex === currentSectionIndex && questionIndex === currentQuestionIndex,
                    completed: isAnswered(answers[question.identifier]),
                  });
                });
                return;
              }
              steps.push({
                key: section.identifier,
                title: readI18n(section.name, language),
                active: sectionIndex === currentSectionIndex,
                completed: completed[sectionIndex],
              });
            });

            return steps.map((step, index) => {
              const letter = stepLabel(index);
              const status = step.active ? 'active' : step.completed ? 'completed' : 'upcoming';
              return (
                <li
                  key={step.key}
                  ref={status === 'active' ? activeStepRef : undefined}
                  className={`${styles.step} ${styles[status]}`}
                  aria-current={status === 'active' ? 'step' : undefined}
                  title={step.title}
                >
                  <span className={styles.stepDot}>{letter}</span>
                </li>
              );
            });
          })()}
        </ol>
      </div>

      <div className={styles.right}>
        {showTimer && (
          <div
            className={`${styles.timer} ${isTimeLow ? styles.timerLow : ''}`.trim()}
            role="timer"
            aria-label={t(language, 'TIME_REMAINING')}
          >
            <TimerIcon size={16} />
            <span className={styles.timerValue}>
              {formatMmSs(showCountdown ? timeRemaining! : timeElapsed!)}
            </span>
          </div>
        )}

        <div className={styles.helpWrap}>
          <button
            type="button"
            className={styles.help}
            onClick={() => setShowLegend((s) => !s)}
            aria-label={t(language, 'HELP_LEGEND_TITLE')}
            aria-expanded={showLegend}
          >
            ?
          </button>

          {showLegend && (
            <>
              <div className={styles.legendBackdrop} onClick={() => setShowLegend(false)} />
              <div className={styles.legend} role="dialog" aria-label={t(language, 'HELP_LEGEND_TITLE')}>
                <p className={styles.legendTitle}>{t(language, 'HELP_LEGEND_TITLE')}</p>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.active}`} aria-hidden="true">A</span>
                  <span>{t(language, 'SECTION_CURRENT')}</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.completed}`} aria-hidden="true">A</span>
                  <span>{t(language, 'SECTION_DONE')}</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.upcoming}`} aria-hidden="true">B</span>
                  <span>{t(language, 'SECTION_UPCOMING')}</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendMark} ${styles.answered}`} aria-hidden="true">●</span>
                  <span>{t(language, 'ANSWERED')}</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendMark} ${styles.unanswered}`} aria-hidden="true">○</span>
                  <span>{t(language, 'UNANSWERED')}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <span className={styles.counter}>
          {questionNumber}/{totalQuestions}
        </span>

        {onReview && (
          // The tooltip lives on this wrapping span, not the button itself —
          // disabled buttons generally don't show their own `title` (and
          // aren't focusable), so the explanation would otherwise be
          // impossible to discover on hover.
          <span title={reviewAvailable ? undefined : t(language, 'REVIEW_AVAILABLE_AT_END')}>
            <button
              type="button"
              className={styles.reviewBtn}
              onClick={onReview}
              disabled={!reviewAvailable}
            >
              {t(language, 'REVIEW')}
            </button>
          </span>
        )}

        <button type="button" className={styles.submitBtn} onClick={onSubmit}>
          {t(language, 'SUBMIT')}
        </button>
      </div>
    </header>
  );
}
