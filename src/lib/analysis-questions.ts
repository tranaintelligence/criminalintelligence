import type { StructuredAnalysis } from './trana-types';

export interface QuestionSection {
  heading: string;
  answer: string;
}

const cleanQuestion = (value: string): string =>
  value
    .replace(/^\s*\d{1,2}[.)]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

export function extractExplicitQuestions(query: string): string[] {
  const numberedMarkers = [...query.matchAll(/(?:^|\s)(\d{1,2})[.)]\s+/g)];

  if (numberedMarkers.length > 0) {
    return numberedMarkers
      .map((marker, index) => {
        const start = (marker.index ?? 0) + marker[0].length;
        const next = numberedMarkers[index + 1];
        const end = next?.index ?? query.length;
        const segment = query.slice(start, end);
        const questionEnd = segment.indexOf('?');
        return cleanQuestion(questionEnd >= 0 ? segment.slice(0, questionEnd + 1) : segment);
      })
      .filter(Boolean);
  }

  return query
    .split('?')
    .slice(0, -1)
    .map((part) => cleanQuestion(`${part}?`))
    .filter(Boolean);
}

const validItems = (items?: string[]): string[] =>
  (items ?? []).filter((item) => item?.trim() && !/^(?:not applicable|none|n\/?a)$/i.test(item.trim()));

const asBullets = (items?: string[]): string => validItems(items).map((item) => `- ${item.trim()}`).join('\n');

function answerForQuestion(question: string, analysis: StructuredAnalysis): string {
  const text = question.toLowerCase();

  if (/\bbail(?:able)?\b/.test(text)) {
    const asksPossibility = /\b(can|could|may|will|how|apply|grant|obtain|get)\b/.test(text);
    const answer = asksPossibility ? analysis.bail_options : analysis.bail_status;
    const primary = answer?.trim() || analysis.bail_status?.trim() || analysis.bail_options?.trim() || '';
    const reasoning = asksPossibility ? analysis.legal_reasoning?.trim() : '';
    return reasoning && !primary.includes(reasoning) ? [primary, reasoning].filter(Boolean).join('\n\n') : primary;
  }

  if (/\bright|arrest|detain|custody|police/.test(text)) {
    return asBullets(analysis.rights) || analysis.legal_reasoning?.trim() || '';
  }

  if (/\blegal aid\b|\bfree (?:legal )?(?:aid|lawyer|advocate|representation)\b|\bdlsa\b|\bnalsa\b/.test(text)) {
    return analysis.legal_aid?.trim() || '';
  }

  if (/\b24\s*hours?\b|\bnext\s*\d*\s*hours?\b|\bwhat should\b|\bwhat can (?:we|i|the family) do\b|\bsteps?\b|\baction plan\b/.test(text)) {
    return asBullets(analysis.next_24_hours);
  }

  if (/\bmeaning\b|\bsituation\b|\bwhat does\b|\bexplain\b/.test(text)) {
    return analysis.situation_meaning?.trim() || analysis.general_analysis?.trim() || '';
  }

  return analysis.general_analysis?.trim() || analysis.legal_reasoning?.trim() || '';
}

export function buildExplicitQuestionSections(query: string, analysis: StructuredAnalysis): QuestionSection[] | null {
  const questions = extractExplicitQuestions(query);
  if (questions.length === 0) return null;

  const sections = questions.map((question, index) => ({
    heading: `${index + 1}. ${question}`,
    answer: answerForQuestion(question, analysis),
  }));

  // Keep a visible answer beneath every extracted question, even if a structured
  // field was omitted by the model. This local check needs no extra LLM call.
  const fallback = analysis.general_analysis?.trim()
    || analysis.legal_reasoning?.trim()
    || 'The available analysis does not contain a specific answer to this question. Please ask the legal aid lawyer to confirm it from the FIR and court record.';

  return sections.map((section) => ({
    ...section,
    answer: section.answer || fallback,
  }));
}
