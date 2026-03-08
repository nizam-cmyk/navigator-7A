// Starter integration stub for NAVIGATOR V7A
import standingRules from '../data/standing_rules.json' assert { type: 'json' };
import formsData from '../data/forms.json' assert { type: 'json' };
import programmesData from '../data/programmes.json' assert { type: 'json' };
import graduationData from '../data/graduation_rules.json' assert { type: 'json' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ reply: 'Method not allowed.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const message = body?.message || '';
    const fileMeta = body?.fileMeta || null;
    const text = String(message || '').toLowerCase().replace(/\s+/g, ' ').trim();

    const mode = detectMode(text, fileMeta);
    let reply = '';

    switch (mode) {
      case 'form':
        reply = 'Plug in getFormResponse(text, formsData) here.';
        break;
      case 'standing':
        reply = 'Plug in getStandingResponse(text, standingRules) here.';
        break;
      case 'graduation':
        reply = 'Plug in getGraduationResponse(text, graduationData, programmesData) here.';
        break;
      case 'transcript':
        reply = 'Plug in getTranscriptResponse(text, standingRules, graduationData, programmesData) here.';
        break;
      case 'programme':
        reply = 'Plug in getProgrammeResponse(text, programmesData) here.';
        break;
      default:
        reply = 'NAVIGATOR can help with programme information, standing, graduation, transcript, and form questions.';
    }

    return res.status(200).json({ mode, reply });
  } catch (error) {
    console.error('V7A error:', error);
    return res.status(500).json({ reply: 'NAVIGATOR encountered an internal error.' });
  }
}

function detectMode(text, fileMeta) {
  const filename = String(fileMeta?.filename || '').toLowerCase();
  const formKeywords = ['form', 'appeal', 'dismissal appeal', 'application', 'withdrawal form', 'deferment', 'postponement', 'rof-'];
  const standingKeywords = ['probation', 'dismissal', 'dismissed', 'academic standing', 'good standing', 'am i on probation', 'will i be dismissed', 'cgpa'];
  const graduationKeywords = ['graduate', 'graduation', 'eligible to graduate', 'can i graduate', 'credits remaining', 'completed credits', 'total credits'];
  const transcriptKeywords = ['transcript', 'statement of results', 'semester results', 'result slip', 'results slip'];
  const programmeKeywords = ['entry requirement', 'duration', 'programme structure', 'total credit hours', 'civil engineering', 'software engineering', 'computer science', 'information technology', 'agricultural science', 'automotive', 'mechanical engineering', 'electronics engineering'];

  if (containsAny(text, formKeywords) || containsAny(filename, formKeywords)) return 'form';
  if (containsAny(text, standingKeywords) && !containsAny(text, transcriptKeywords)) return 'standing';
  if (containsAny(text, graduationKeywords)) return 'graduation';
  if (containsAny(text, transcriptKeywords) || filename.includes('transcript') || filename.includes('result')) return 'transcript';
  if (containsAny(text, programmeKeywords)) return 'programme';
  return 'general';
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}
