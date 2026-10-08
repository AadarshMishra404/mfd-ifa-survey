/* questions.js — the survey content, transcribed from
 * "Next-Gen MFD & IFA Practice Survey.docx".
 *
 * priority comes from the colour of each question in the document:
 *   1 = red   (high)   → required
 *   2 = green (second) → recommended (nudged once if skipped)
 *   3 = black (third)  → optional
 *
 * To change the survey, edit this file only.
 */

window.SURVEY = {
  title: 'Next-Gen MFD & IFA Practice Survey',
  minutes: '12–15',
  intro: [
    'This survey asks new and second-generation Mutual Fund Distributors (MFDs) and Independent Financial Advisors (IFAs) what is holding their practice back and what support would help them grow.',
    'Your answers will shape learning programmes, tools and platform support built for practitioners like you. Responses are confidential and reported only in aggregate; no individual answers will be shared or used for marketing without your consent.',
  ],
  whoShould: 'Practitioners in their first 7 years of practice, or those who have joined or taken over a family/parent\'s advisory business.',
  howTo: 'Pick the option closest to your view. Where a question says "select all that apply" or "rank", please do so. There are no right or wrong answers.',

  sections: {
    A: 'About you and your practice',
    B: 'Challenges in scaling your business',
  },

  questions: [
    {
      id: 'q1', num: 1, section: 'A', priority: 3, type: 'fields',
      title: 'Name and city',
      hint: 'Optional',
      fields: [
        { key: 'name', label: 'Your name', placeholder: 'e.g. Priya Sharma' },
        { key: 'city', label: 'City', placeholder: 'e.g. Pune' },
      ],
    },
    {
      id: 'q2', num: 2, section: 'A', priority: 3, type: 'single', other: true,
      title: 'Which best describes you?',
      options: [
        'First-generation MFD/IFA (started my own practice)',
        'Second-generation (joined or took over a parent\'s/family practice)',
        'Moved from a bank, broking house or AMC into independent practice',
        'Part-time practitioner alongside another profession',
      ],
    },
    {
      id: 'q3', num: 3, section: 'A', priority: 3, type: 'single',
      title: 'How many years have you been in practice?',
      options: ['Less than 1 year', '1–3 years', '3–5 years', '5–7 years', 'More than 7 years'],
    },
    {
      id: 'q4', num: 4, section: 'A', priority: 3, type: 'single',
      title: 'Your age group',
      options: ['Under 25', '25–30', '31–35', '36–40', 'Above 40'],
    },
    {
      id: 'q5', num: 5, section: 'A', priority: 1, type: 'multi', other: true,
      title: 'Registrations and certifications you hold',
      hint: 'Select all that apply',
      options: [
        'AMFI ARN (NISM Series V-A)',
        'SEBI Registered Investment Adviser (RIA)',
        'Insurance (IRDAI agent / POSP / corporate agency)',
        'NPS Point of Presence / NPS Consultant',
        'Stock broker AP / sub-broker',
        'PMS / AIF distribution (NISM XXI-A / XIX)',
        'CFP / CFA / CA / MBA (Finance)',
      ],
    },
    {
      id: 'q6', num: 6, section: 'A', priority: 3, type: 'single',
      title: 'Approximate Assets Under Management (AUM) you service',
      options: ['Below ₹5 crore', '₹5–25 crore', '₹25–50 crore', '₹50–100 crore', '₹100–250 crore', 'Above ₹250 crore'],
    },
    {
      id: 'q7', num: 7, section: 'A', priority: 2, type: 'single',
      title: 'Number of active client families',
      options: ['Fewer than 50', '50–150', '150–300', '300–500', 'More than 500'],
    },
    {
      id: 'q8', num: 8, section: 'A', priority: 2, type: 'single',
      title: 'Monthly SIP book you service',
      options: ['Below ₹5 lakh', '₹5–25 lakh', '₹25–50 lakh', '₹50 lakh–₹1 crore', 'Above ₹1 crore'],
    },
    {
      id: 'q9', num: 9, section: 'A', priority: 2, type: 'single',
      title: 'Team size (including yourself)',
      options: ['Just me', '2–3', '4–10', 'More than 10'],
    },
    {
      id: 'q10', num: 10, section: 'A', priority: 1, type: 'single',
      title: 'Where are most of your clients located?',
      options: ['Metro city (T15)', 'Tier 2 city', 'Tier 3 town / semi-urban', 'Rural', 'Spread across India / NRI clients'],
    },
    {
      id: 'q11', num: 11, section: 'A', priority: 2, type: 'multi', max: 2,
      title: 'Primary client segment',
      hint: 'Select up to two',
      options: [
        'Salaried professionals',
        'Business owners / self-employed',
        'Retirees / senior citizens',
        'HNI / family offices',
        'Young investors (under 30)',
        'NRIs',
        'Corporates / institutions',
      ],
    },
    {
      id: 'q12', num: 12, section: 'B', priority: 1, type: 'grid',
      title: 'How much of a challenge is each of the following for you today?',
      hint: '1 = not a challenge, 5 = a major challenge',
      scale: ['Not a challenge', 'Minor', 'Moderate', 'Significant', 'Major challenge'],
      rows: [
        'Acquiring new clients consistently',
        'Building trust and credibility as a young / new advisor',
        'Competition from direct plans, fintech apps and discount platforms',
        'Competition from banks and large wealth firms',
        'Low or declining trail commissions',
        'Irregular cash flow in the early years',
        'Managing operations and paperwork (KYC, nominations, transmission, mandates)',
        'Using too many separate platforms / logins for different products',
        'Lack of technology (CRM, portfolio reporting, client app)',
        'Hiring and retaining good support staff',
        'Keeping up with regulatory and compliance changes',
        'Limited product knowledge beyond mutual funds',
        'Handling client behavior in volatile markets',
        'Marketing and building a personal brand / digital presence',
        'Succession / taking over clients from the previous generation',
        'Finding time for learning while running the practice',
      ],
    },
    {
      id: 'q13', num: 13, section: 'B', priority: 1, type: 'text',
      title: 'Which ONE challenge, if solved, would most change your growth in the next 2 years?',
      hint: 'Tap one of your top-rated challenges below, or write your own',
      placeholder: 'Type your answer…',
      suggestFrom: 'q12',
    },
    {
      id: 'q14', num: 14, section: 'B', priority: 1, type: 'multi', max: 3, other: true,
      title: 'How do you currently acquire most new clients?',
      hint: 'Select up to three',
      options: [
        'Referrals from existing clients',
        'Family and personal network',
        'Social media (Instagram, YouTube, LinkedIn)',
        'WhatsApp groups / broadcasts',
        'Seminars, workshops and investor awareness programmes',
        'Tie-ups with CAs, lawyers, real-estate agents or employers',
        'Business associations / networking groups',
        'Paid digital marketing',
      ],
    },
    {
      id: 'q15', num: 15, section: 'B', priority: 2, type: 'single',
      title: 'How many new client families do you add in a typical year?',
      options: ['Fewer than 10', '10–25', '25–50', '50–100', 'More than 100'],
    },
    {
      id: 'q16', num: 16, section: 'B', priority: 1, type: 'single',
      title: 'Roughly what share of your working time goes into non-revenue activities?',
      hint: 'Operations, paperwork, follow-ups, reconciliation',
      options: ['Less than 20%', '20–40%', '40–60%', 'More than 60%'],
    },
    {
      id: 'q17', num: 17, section: 'B', priority: 1, type: 'single',
      title: 'What has been the biggest challenge in taking over or growing the family practice?',
      hint: 'Select the applicable option',
      options: [
        'Older clients prefer dealing with my parent / predecessor',
        'Outdated processes and records',
        'Differences in approach or product preference',
        'Client base is ageing and needs a next-gen connect',
        'Difficulty digitizing the existing book',
        'Not applicable',
      ],
      // Only second-generation practitioners see this; everyone else is
      // recorded as "Not applicable".
      showIf: (a) => a.q2 === 'Second-generation (joined or took over a parent\'s/family practice)',
      whenHidden: 'Not applicable',
    },
  ],
};

window.PRIORITY = {
  1: { key: 'p1', label: 'Required',    long: 'High priority' },
  2: { key: 'p2', label: 'Recommended', long: 'Second priority' },
  3: { key: 'p3', label: 'Optional',    long: 'Third priority' },
};
