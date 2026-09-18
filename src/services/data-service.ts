/**
 * Data service — the only place React talks to for assessment data.
 *
 * Responsibilities (per the approved architecture):
 *   - call the APIs via the shared Axios http-client,
 *   - fetch the questionset hierarchy,
 *   - fetch the question list,
 *   - MERGE the raw responses,
 *   - hand the merged RAW data to transformation-service, and
 *   - return the normalized result.
 *
 * It deliberately owns NO normalization logic — transformation-service is the
 * single source of truth for that. Errors surface as typed QumlApiError.
 */

import { httpGet, httpPost } from './http-client';
import { transformSection, transformQuestion } from './transformation-service';
import { ApiPaths, DEFAULT_API_PREFIX } from '../utils/api-endpoints';
import { QumlApiError } from '../types/api';
import type {
  QuestionSetHierarchyResult,
  QuestionListResult,
  RawQuestionSet,
  RawQuestionSetChild,
  RawQuestion,
} from '../types/api';
import type { Question, Section } from '../types';

export interface LoadOptions {
  /** Content base URL; forwarded to axios per-request so it can differ per call. */
  baseUrl?: string;
  /** Language passed to /question/v5/list as `?lang=`. */
  language?: string;
  /**
   * API path prefix (the host slug, e.g. the portal's `/portal`). Prepended to
   * the resource paths in ApiPaths. This is the React equivalent of Angular's
   * host-provided QuestionCursor deciding the URL. Falls back to `/api` when the
   * host does not supply one. A full `window.question*Url` override still wins.
   */
  pathPrefix?: string;
  /**
   * Authoring/preview context — fetch the DRAFT working copy rather than the
   * published one.
   *
   * On the Sunbird backend `?mode=edit` returns the Draft/`.img` node instead
   * of the Live node whenever a draft exists. That is what an editor preview
   * wants (the whole point is to see unsaved/unpublished work), but it must
   * never be the default: the fetch path this flag controls is also used for
   * real learner delivery, where serving a creator's in-progress draft is a
   * content leak. Defaults to false, so Draft access is always an explicit
   * opt-in.
   */
  previewMode?: boolean;
}

/** Normalize the API path prefix (host slug); falls back to `/api`. */
function apiPrefix(prefix?: string): string {
  const p = typeof prefix === 'string' && prefix.trim() ? prefix.trim() : DEFAULT_API_PREFIX;
  // ApiPaths already start with `/`, so drop any trailing slash on the prefix.
  return p.replace(/\/+$/, '');
}

export interface LoadedQuestionSet {
  /** Raw questionset root — assessment-level metadata (name, timeLimits, …). */
  metadata: RawQuestionSet;
  /** Normalized sections, each with its normalized child questions. */
  sections: Section[];
}

/**
 * Host-provided endpoint override (the Sunbird QuestionCursor equivalent).
 * The player's default API paths don't match every host's proxy routing (e.g.
 * the portal serves the question list under `/action/…`, not `/api/…`, and does
 * not proxy `/learner/…`). A host can set `window.questionListUrl` /
 * `window.questionSetHierarchyUrl` to point the fetch at the right route; we fall
 * back to the built-in defaults (which the editor's dev proxy serves) otherwise.
 */
function hostEndpoint(key: 'questionListUrl' | 'questionSetHierarchyUrl'): string | undefined {
  const val = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>)[key] : undefined;
  return typeof val === 'string' && val ? val : undefined;
}

/** Fetch the raw questionset hierarchy (`result.questionset`). */
export async function getQuestionSetHierarchy(
  identifier: string,
  opts: LoadOptions = {},
): Promise<RawQuestionSet> {
  if (!identifier) {
    throw new QumlApiError('invalid', 'getQuestionSetHierarchy: identifier is required');
  }
  const base =
    hostEndpoint('questionSetHierarchyUrl') ??
    `${apiPrefix(opts.pathPrefix)}${ApiPaths.questionSetHierarchy}`;
  // Base ends with `/` (identifier appended); tolerate a host value without one.
  const path = base.endsWith('/') ? `${base}${identifier}` : `${base}/${identifier}`;
  // `mode=edit` makes the backend return the Draft/.img working copy over the
  // Live node, so it is opt-in for authoring previews only (see
  // LoadOptions.previewMode). Learner delivery falls through to the plain
  // path and therefore only ever sees published content.
  const url = opts.previewMode
    ? path.includes('?')
      ? `${path}&mode=edit`
      : `${path}?mode=edit`
    : path;
  const result = await httpGet<QuestionSetHierarchyResult>(url, { baseURL: opts.baseUrl });
  if (!result?.questionset) {
    throw new QumlApiError('invalid', 'Hierarchy response missing `questionset`');
  }
  return result.questionset;
}

/**
 * Max identifiers per /question/v5/list POST. Large question sets are chunked to
 * stay under backend request-body/item caps (Angular batched similarly via
 * _.chunk); chunks are fetched concurrently and their results concatenated.
 */
const QUESTION_BATCH_SIZE = 50;

/** Fetch raw question objects for the given identifiers (`result.questions`). */
export async function getQuestions(
  identifiers: string[],
  opts: LoadOptions = {},
): Promise<RawQuestion[]> {
  if (!identifiers || identifiers.length === 0) return [];
  const listBase =
    hostEndpoint('questionListUrl') ?? `${apiPrefix(opts.pathPrefix)}${ApiPaths.questionList}`;
  const url = opts.language ? `${listBase}?lang=${opts.language}` : listBase;

  const chunks: string[][] = [];
  for (let i = 0; i < identifiers.length; i += QUESTION_BATCH_SIZE) {
    chunks.push(identifiers.slice(i, i + QUESTION_BATCH_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      httpPost<QuestionListResult>(
        url,
        { request: { search: { identifier: chunk } } },
        { baseURL: opts.baseUrl },
      ),
    ),
  );
  return results.flatMap((r) => r?.questions ?? []);
}

/**
 * Section-level config/metadata a synthetic (implicit) section inherits from
 * the questionset root, since it has no authored section node of its own.
 */
const IMPLICIT_SECTION_INHERITED_KEYS = [
  'instructions',
  'timeLimits',
  'allowSkip',
  'shuffle',
  'showTimer',
  'showSolutions',
  'showHints',
  'showFeedback',
  'metadata',
] as const;

/** Build a synthetic section node wrapping a run of root-level question stubs. */
function wrapImplicitSection(
  questionSet: RawQuestionSet,
  runIndex: number,
  run: RawQuestionSetChild[],
): RawQuestionSetChild {
  const inherited: Record<string, unknown> = {};
  for (const key of IMPLICIT_SECTION_INHERITED_KEYS) {
    if (questionSet[key] !== undefined) inherited[key] = questionSet[key];
  }
  return {
    ...inherited,
    identifier: `${questionSet.identifier}_implicit_${runIndex}`,
    objectType: 'QuestionSet',
    name: questionSet.name,
    isImplicitSection: true,
    children: run,
  } as unknown as RawQuestionSetChild;
}

/**
 * Top-level children that represent sections (question stubs live under
 * them). Three layouts are supported:
 *  - fully sectioned: every child is a Section → returned as-is;
 *  - fully flat: every child is a bare Question → the whole root is wrapped
 *    as one implicit section;
 *  - mixed: Section and bare Question children interleaved at root → each
 *    consecutive run of loose questions is wrapped as its own implicit
 *    section, preserving the original hierarchy order relative to the real,
 *    authored sections.
 */
function extractSectionNodes(questionSet: RawQuestionSet): RawQuestionSetChild[] {
  const children = questionSet.children ?? [];
  if (children.length === 0) return [];

  const allQuestions = children.every((c) => c.objectType === 'Question');
  if (allQuestions) {
    return [{ ...questionSet, isImplicitSection: true } as unknown as RawQuestionSetChild];
  }
  if (children.every((c) => c.objectType !== 'Question')) return children;

  // Mixed layout: walk children in order, grouping consecutive loose
  // questions into implicit sections interleaved with the real ones.
  const nodes: RawQuestionSetChild[] = [];
  let runIndex = 0;
  for (let i = 0; i < children.length; ) {
    if (children[i].objectType !== 'Question') {
      nodes.push(children[i]);
      i += 1;
      continue;
    }
    const run: RawQuestionSetChild[] = [];
    while (i < children.length && children[i].objectType === 'Question') {
      run.push(children[i]);
      i += 1;
    }
    nodes.push(wrapImplicitSection(questionSet, runIndex, run));
    runIndex += 1;
  }
  return nodes;
}

/** Question stubs within a section, ordered by `index` when present. */
function orderedQuestionStubs(section: RawQuestionSetChild): RawQuestionSetChild[] {
  const stubs = (section.children ?? []).filter((c) => c.objectType === 'Question' || !c.children);
  return [...stubs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

/**
 * Fetch hierarchy + questions, merge raw, and normalize via transformation-service.
 * The stub (hierarchy) supplies ordering/section context; the fetched question
 * supplies the real content — fetched fields win on the merge.
 */
export async function loadQuestionSet(
  identifier: string,
  opts: LoadOptions = {},
): Promise<LoadedQuestionSet> {
  const questionSet = await getQuestionSetHierarchy(identifier, opts);
  const sectionNodes = extractSectionNodes(questionSet);

  // Collect every question identifier across all sections (one batched call).
  const stubsBySection = sectionNodes.map(orderedQuestionStubs);
  const allIds = stubsBySection.flat().map((s) => s.identifier);
  const questions = await getQuestions(allIds, opts);
  const questionById = new Map<string, RawQuestion>(questions.map((q) => [q.identifier, q]));

  const sections = sectionNodes
    .map((node, i): Section | null => {
      const normalizedSection = transformSection(node);
      if (!normalizedSection) return null;
      const children = stubsBySection[i]
        .map((stub) => {
          const fetched = questionById.get(stub.identifier);
          // Merge raw: stub metadata + fetched content (fetched wins), then normalize.
          const mergedRaw = { ...stub, ...(fetched ?? {}) };
          return transformQuestion(mergedRaw);
        })
        .filter((q): q is Question => Boolean(q));
      return { ...normalizedSection, children };
    })
    .filter((s): s is Section => Boolean(s));

  return { metadata: questionSet, sections };
}

/**
 * True when a raw questionset already carries fully-authored question content
 * embedded in its hierarchy (a leaf question has `body` or `interactions`), so it
 * can be rendered without any network fetch. Hosts like the Sunbird editor/portal
 * pass the whole questionset (with content) as `playerConfig.metadata`; a plain
 * hierarchy read, by contrast, contains only stub questions (no body).
 */
export function hasEmbeddedQuestions(questionSet: any): boolean {
  if (!questionSet || typeof questionSet !== 'object') return false;
  return extractSectionNodes(questionSet).some((section) =>
    orderedQuestionStubs(section).some(
      (q: any) => q && (q.body || (q.interactions && Object.keys(q.interactions).length > 0)),
    ),
  );
}

/**
 * Build normalized sections from a questionset whose questions are ALREADY
 * embedded (see hasEmbeddedQuestions) — no network calls. Mirrors loadQuestionSet
 * minus the fetch/merge: each embedded question IS the full content.
 */
export function transformEmbeddedQuestionSet(questionSet: any): Section[] {
  return extractSectionNodes(questionSet)
    .map((node): Section | null => {
      const normalizedSection = transformSection(node);
      if (!normalizedSection) return null;
      const children = orderedQuestionStubs(node)
        .map((q) => transformQuestion(q))
        .filter((q): q is Question => Boolean(q));
      return { ...normalizedSection, children };
    })
    .filter((s): s is Section => Boolean(s));
}
