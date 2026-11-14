import { describe, expect, it } from 'vitest';

import { buildExplicitQuestionSections, extractExplicitQuestions } from '@/lib/analysis-questions';
import type { StructuredAnalysis } from '@/lib/trana-types';

const custodyQuery = 'My 23-year-old brother, a daily-wage worker in Delhi, has been arrested for allegedly stealing a laptop worth ₹35,000. Police registered an FIR under Section 303(2) BNS. He has no criminal record, and our family cannot afford a private lawyer. Police have not clearly explained his arrest grounds, and we don’t know if he has been produced before a Magistrate. Please explain: 1. Is the offence bailable? 2. Can he get bail? 3. What are his rights after arrest? 4. Can he get free legal aid, and where in Delhi? 5. What should our family do in the next 24 hours? Explain simply and guide us step by step.';

const custodyAnalysis: StructuredAnalysis = {
  bail_status: 'BNS 303(2) is ordinarily non-bailable under the BNSS First Schedule.',
  bail_options: 'Yes. A Magistrate may consider bail under BNSS Section 480; non-bailable does not mean bail is barred.',
  rights: ['Police must communicate the grounds of arrest under BNSS Section 47.', 'Production before a Magistrate is due within 24 hours, excluding travel time.'],
  legal_aid: 'A person in custody can seek free legal services under Section 12(g); contact DSLSA in Delhi at 1516 or NALSA at 15100.',
  next_24_hours: ['Call the police station to confirm arrest time and location.', 'Ask the Magistrate or jail legal aid clinic for a DLSA lawyer.'],
};

describe('explicit question answer formatting', () => {
  it('extracts all numbered questions and places the matching answer under each', () => {
    const sections = buildExplicitQuestionSections(custodyQuery, custodyAnalysis);

    expect(sections).toHaveLength(5);
    expect(sections?.map(({ heading }) => heading)).toEqual([
      '1. Is the offence bailable?',
      '2. Can he get bail?',
      '3. What are his rights after arrest?',
      '4. Can he get free legal aid, and where in Delhi?',
      '5. What should our family do in the next 24 hours?',
    ]);
    expect(sections?.[0].answer).toContain('non-bailable');
    expect(sections?.[1].answer).toContain('BNSS Section 480');
    expect(sections?.[2].answer).toContain('Section 47');
    expect(sections?.[3].answer).toContain('DSLSA');
    expect(sections?.[4].answer).toContain('Call the police station');
    expect(sections?.every(({ answer }) => answer.trim().length > 0)).toBe(true);
  });

  it('supports direct questions without numbering', () => {
    expect(extractExplicitQuestions('Can he get bail? What are his arrest rights?')).toEqual([
      'Can he get bail?',
      'What are his arrest rights?',
    ]);
  });

  it('keeps every question visible when a specific answer field is missing', () => {
    const sections = buildExplicitQuestionSections('1. Where can we get legal aid?', {
      general_analysis: 'Please contact the court legal services clinic.',
    });

    expect(sections).toEqual([
      { heading: '1. Where can we get legal aid?', answer: 'Please contact the court legal services clinic.' },
    ]);
  });
});
