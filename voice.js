// Voice transcript → text. Pure functions (no DOM) so they can be tested in node.
// SpeechRecognition (ja-JP) returns each confirmed phrase without punctuation on Chrome, sometimes
// with it on Safari, and sometimes with spaces between Japanese words. We end each final phrase
// with 。 (or ？ for clear question endings) unless it already ends with punctuation, and start a
// new line when the speaker paused for gapMs or longer.
const JA = '\\u3000-\\u303f\\u3040-\\u30ff\\u3400-\\u9fff\\uff01-\\uff60';
const SPACE_IN_JA = new RegExp(`([${JA}])\\s+(?=[${JA}])`, 'g');
const ENDS = /[。．.！!？?…」』）)]$/;
const QUESTION = /(かな|かしら|だろうか|でしょうか|ですか|ますか)$/;

export function tidy(t) {
  return String(t || '').trim().replace(SPACE_IN_JA, '$1');
}

export function punctuate(t) {
  t = tidy(t);
  if (!t || ENDS.test(t)) return t;
  return t + (QUESTION.test(t) ? '？' : '。');
}

// segs: [{ text, final, start, end }] in result order. start = when the phrase first appeared (ms),
// end = when it became final (ms). Interim (non-final) phrases are shown as-is.
export function joinSegments(segs, gapMs = 3000) {
  let out = '', prev = null;
  for (const s of segs) {
    if (!s) continue;
    const piece = s.final ? punctuate(s.text) : tidy(s.text);
    if (!piece) continue;
    if (out && prev && prev.end != null && s.start - prev.end >= gapMs) out += '\n';
    out += piece; prev = s;
  }
  return out;
}
