import fs from 'fs';
import path from 'path';

function readJson(filename) {
  const filePath = path.join(process.cwd(), 'data', filename);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

const standingRules = readJson('standing_rules.json');
const formsData = readJson('forms.json');
const programmesData = readJson('programmes.json');
const graduationData = readJson('graduation_rules.json');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      reply: 'Method not allowed.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const message = body?.message || '';
    const fileMeta = body?.fileMeta || null;

    const text = normaliseText(message);
    const mode = detectMode(text, fileMeta);

    let reply = '';

    switch (mode) {
      case 'form':
        reply = getFormResponse(text, formsData);
        break;
      case 'standing':
        reply = getStandingResponse(text, standingRules);
        break;
      case 'graduation':
        reply = getGraduationResponse(text, graduationData, programmesData);
        break;
      case 'transcript':
        reply = getTranscriptResponse(text, standingRules, graduationData, programmesData);
        break;
      case 'programme':
        reply = getProgrammeResponse(text, programmesData);
        break;
      default:
        reply = getFallbackResponse();
    }

    return res.status(200).json({
      mode,
      reply
    });
  } catch (error) {
    console.error('NAVIGATOR V7A error:', error);
    return res.status(200).json({
      mode: 'error',
      reply: 'NAVIGATOR encountered an internal error while processing your request. Please try again.'
    });
  }
}

function normaliseText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function detectMode(text, fileMeta) {
  const filename = normaliseText(fileMeta?.filename || '');

  const formKeywords = [
    'form',
    'appeal',
    'dismissal appeal',
    'application',
    'withdrawal form',
    'deferment',
    'postponement',
    'rof-'
  ];

  const standingKeywords = [
    'probation',
    'dismissal',
    'dismissed',
    'academic standing',
    'good standing',
    'am i on probation',
    'will i be dismissed',
    'cgpa'
  ];

  const graduationKeywords = [
    'graduate',
    'graduation',
    'eligible to graduate',
    'can i graduate',
    'credits remaining',
    'completed credits',
    'total credits'
  ];

  const transcriptKeywords = [
    'transcript',
    'statement of results',
    'semester results',
    'result slip',
    'results slip'
  ];

  const programmeKeywords = [
    'entry requirement',
    'duration',
    'programme structure',
    'total credit hours',
    'civil engineering',
    'software engineering',
    'computer science',
    'information technology',
    'agricultural science',
    'automotive',
    'mechanical engineering',
    'electronics engineering'
  ];

  if (containsAny(text, formKeywords) || containsAny(filename, formKeywords)) {
    return 'form';
  }

  if (containsAny(text, standingKeywords) && !containsAny(text, transcriptKeywords)) {
    return 'standing';
  }

  if (containsAny(text, graduationKeywords)) {
    return 'graduation';
  }

  if (containsAny(text, transcriptKeywords) || looksLikeTranscriptFilename(filename)) {
    return 'transcript';
  }

  if (containsAny(text, programmeKeywords)) {
    return 'programme';
  }

  return 'general';
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function looksLikeTranscriptFilename(filename) {
  return (
    filename.includes('transcript') ||
    filename.includes('result') ||
    filename.includes('statement')
  );
}

function extractCgpa(text) {
  const match = text.match(/cgpa\s*(?:is|=|:)?\s*(\d+(?:\.\d+)?)/i);
  return match ? parseFloat(match[1]) : null;
}

function extractCredits(text) {
  const match = text.match(/(\d+)\s*credits?/i);
  return match ? parseInt(match[1], 10) : null;
}

function detectProgramme(text, programmesData) {
  const programmes = programmesData?.programmes || [];
  for (const programme of programmes) {
    if ((programme.aliases || []).some((alias) => text.includes(alias.toLowerCase()))) {
      return programme;
    }
  }
  return null;
}

function getStandingResponse(text, standingRules) {
  const cgpa = extractCgpa(text);
  const rules = standingRules?.rules || {};

  if (cgpa === null) {
    return `NAVIGATOR · standing

Issue Summary:
You are asking about academic standing or probation.

Handbook Basis:
Good Status applies from CGPA ${rules.good_status?.cgpa_min?.toFixed(2) || '2.00'} and above.
Probation may apply when CGPA is below ${rules.probation_1?.cgpa_below?.toFixed(2) || '2.00'}.

Recommended Action:
1. Check your current CGPA and whether this is your first or repeated semester below 2.00.
2. Review the official standing outcome issued by the faculty or registrar.
3. Contact your academic advisor if you are academically at risk.

Important Note:
Final standing depends on official academic records and consecutive semester pattern.`;
  }

  let status = 'Academic risk';
  let explanation =
    'Your stated CGPA is below 2.00, which may place you under academic probation depending on your official semester record.';

  if (cgpa >= (rules.good_status?.cgpa_min || 2.0)) {
    status = rules.good_status?.label || 'Good Status';
    explanation = 'Your stated CGPA is at or above 2.00, which is generally consistent with good academic standing.';
  }

  return `NAVIGATOR · standing

Issue Summary:
You are asking whether a CGPA of ${cgpa.toFixed(2)} affects your academic standing.

Handbook Basis:
Good Status: ${rules.good_status?.condition || 'CGPA 2.00 and above'}.
Probation: ${rules.probation_1?.condition || 'CGPA below 2.00'}.

Assessment:
${explanation}

Likely Status:
${status}

Recommended Action:
1. Check whether this is your first, second, or third consecutive semester below 2.00.
2. Review your official result notification.
3. Meet your academic advisor or Faculty Academic Office for confirmation.

Important Note:
NAVIGATOR provides a handbook-based preliminary interpretation only.`;
}

function getFormResponse(text, formsData) {
  const forms = formsData?.forms || [];
  const matchedForm =
    forms.find((form) =>
      (form.form_name || '').toLowerCase().includes('dismissal') && text.includes('dismiss')
    ) ||
    forms.find((form) =>
      (form.form_name || '').toLowerCase().includes('withdrawal') && text.includes('withdraw')
    ) ||
    forms.find((form) =>
      (form.form_name || '').toLowerCase().includes('postponement') &&
      (text.includes('postpone') || text.includes('defer'))
    );

  if (!matchedForm) {
    return `NAVIGATOR · form

Issue Summary:
You are asking about an academic form or appeal document.

Recommended Action:
1. Tell me the exact form name or upload the form title clearly.
2. I can then provide the checklist, attachments, and submission steps.

Examples:
- Academic Dismissal Appeal Form
- Course Withdrawal Form
- Application for Postponement of Studies`;
  }

  const fields = (matchedForm.required_fields || []).map((item) => `- ${item}`).join('\n');
  const attachments = (matchedForm.required_attachments || []).length
    ? matchedForm.required_attachments.map((item) => `- ${item}`).join('\n')
    : '- Please confirm from the official form.';

  const steps = (matchedForm.submit_to || []).length
    ? `1. Complete all required fields.
2. Attach all supporting documents.
3. Submit to: ${matchedForm.submit_to.join(', ')}.
4. Submit within: ${matchedForm.submission_deadline || 'the official time limit stated on the form'}.`
    : `1. Complete all required fields.
2. Attach all supporting documents.
3. Submit according to the instructions stated on the form.`;

  return `NAVIGATOR · form

Form Identified:
${matchedForm.form_name}${matchedForm.form_code ? ` (${matchedForm.form_code})` : ''}

Purpose:
${matchedForm.purpose || 'Not specified.'}

Fields / Information to Prepare:
${fields || '- Please refer to the official form.'}

Attachments Required:
${attachments}

Submission Steps:
${steps}

Important Note:
${matchedForm.post_approval_note || 'This is a handbook/form-based procedural summary. Final submission must follow the official document.'}`;
}

function getGraduationResponse(text, graduationData, programmesData) {
  const credits = extractCredits(text);
  const programme = detectProgramme(text, programmesData);
  const rules = graduationData?.graduation_rules || [];

  if (!programme) {
    return `NAVIGATOR · graduation

Issue Summary:
You are asking about graduation eligibility.

Recommended Action:
1. Please state your programme name.
2. If available, provide your completed credits and CGPA.

Example:
“I am in Bachelor in Software Engineering and I have completed 109 credits.”`;
  }

  const rule = rules.find((item) => item.programme_code === programme.code);

  if (!rule || rule.required_total_credits == null) {
    return `NAVIGATOR · graduation

Programme:
${programme.name}

Issue Summary:
Graduation eligibility cannot be fully confirmed yet for this programme in the current V7A mapping.

Reason:
The exact required total credits or full compulsory component map is not yet fully structured in the backend data.

Recommended Action:
1. Confirm your completed credits and CGPA.
2. Refer to the official programme structure and Faculty Academic Office for final confirmation.`;
  }

  const remainingCredits =
    credits != null ? Math.max(rule.required_total_credits - credits, 0) : null;

  return `NAVIGATOR · graduation

Programme:
${programme.name}

Handbook Basis:
Required total credits: ${rule.required_total_credits}
Minimum academic standing threshold reference: CGPA ${rule.cgpa_min_for_good_status?.toFixed(2) || '2.00'}

Evaluation:
Credits completed: ${credits != null ? credits : 'Not provided'}
Credit requirement status: ${credits != null ? (credits >= rule.required_total_credits ? 'Met' : 'Not yet met') : 'Unable to assess without completed credits'}
Compulsory components must also be completed where applicable.

Verdict:
${credits == null
  ? 'Cannot confirm fully without your completed credit count.'
  : credits >= rule.required_total_credits
    ? 'You may be close to eligibility, but final confirmation still depends on compulsory component completion and official faculty verification.'
    : 'Not yet eligible based on current credit count.'}

Remaining Requirement:
${remainingCredits == null ? 'Please provide completed credits.' : `${remainingCredits} credit hour(s) remaining.`}

Important Note:
NAVIGATOR provides a handbook-based preliminary graduation check only.`;
}

function getProgrammeResponse(text, programmesData) {
  const programme = detectProgramme(text, programmesData);

  if (!programme) {
    return `NAVIGATOR · programme

Issue Summary:
You are asking about a FEST programme.

Recommended Action:
Please state the programme name more specifically, for example:
- Civil Engineering
- Software Engineering
- Computer Science
- Diploma in Information Technology`;
  }

  const entryReqs = (programme.entry_requirements?.length
    ? programme.entry_requirements.map((item) => `- ${item}`).join('\n')
    : '- Entry requirements for this programme are not yet fully structured in the current V7A data.');

  const notes = (programme.programme_notes?.length
    ? programme.programme_notes.map((item) => `- ${item}`).join('\n')
    : '- No additional notes available.');

  return `NAVIGATOR · programme

Programme:
${programme.name}

Duration:
${programme.duration || 'Not yet mapped in the current backend dataset.'}

Total Credit Hours:
${programme.total_credit_hours != null ? programme.total_credit_hours : 'Not yet fully mapped in the current backend dataset.'}

Entry Requirements:
${entryReqs}

Notes:
${notes}

Handbook Reference:
${programme.handbook_reference || 'FEST Academic Handbook'}`;
}

function getTranscriptResponse(text, standingRules, graduationData, programmesData) {
  const cgpa = extractCgpa(text);
  const credits = extractCredits(text);
  const programme = detectProgramme(text, programmesData);

  return `NAVIGATOR · transcript

Transcript Extract (Preliminary):
- Programme: ${programme ? programme.name : 'Not identified'}
- CGPA: ${cgpa != null ? cgpa.toFixed(2) : 'Not identified'}
- Credits: ${credits != null ? credits : 'Not identified'}

Next Step:
This V7A transcript mode is currently a bridge mode.
It can use simple extracted values to support standing and graduation interpretation, but it is not yet full transcript parsing.

Recommended Action:
1. State your programme name clearly.
2. Provide CGPA and completed credits if known.
3. Ask one focused question, for example: “Am I on probation?” or “Can I graduate?”`;
}

function getFallbackResponse() {
  return `NAVIGATOR

I can currently help with:
- programme information
- entry requirements
- academic standing
- graduation eligibility
- academic forms and appeals

Try asking:
- “What are the entry requirements for Civil Engineering?”
- “My CGPA is 1.95. Am I on probation?”
- “I have 109 credits. Can I graduate?”
- “I uploaded a dismissal appeal form. What should I do?”`;
}