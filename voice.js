// Voice transcript → text. Pure functions (no DOM) so they can be tested in node.
// SpeechRecognition (ja-JP) returns each confirmed phrase without punctuation on Chrome, sometimes
// with it on Safari, and sometimes with spaces between Japanese words. We end each final phrase
// with 。 (or ？ for clear question endings) unless it already ends with punctuation, and start a
// new line when the speaker paused for gapMs or longer.
const JA = '\\u3000-\\u303f\\u3040-\\u30ff\\u3400-\\u9fff\\uff01-\\uff60';
const SPACE_IN_JA = new RegExp(`([${JA}])\\s+(?=[${JA}])`, 'g');
const ENDS = /[。．.！!？?…」』）)]$/;
const QUESTION = /(かな|かしら|だろうか|でしょうか|ですか|ますか)$/;
// English (en-US recognition): sentence case, '?' when the phrase opens like a question, phrases joined by a space.
const EN_QUESTION = /^(what|why|how|when|where|who|which|is|are|was|were|do|does|did|can|could|would|will|should|shall|may|have|has)\b/i;

export function tidy(t) {
  return String(t || '').trim().replace(SPACE_IN_JA, '$1');
}

export function punctuate(t, lang = 'ja') {
  t = tidy(t);
  if (lang === 'en') { if (!t) return t; t = t[0].toUpperCase() + t.slice(1); return ENDS.test(t) ? t : t + (EN_QUESTION.test(t) ? '?' : '.'); }
  if (!t || ENDS.test(t)) return t;
  return t + (QUESTION.test(t) ? '？' : '。');
}

// segs: [{ text, final, start, end }] in result order. start = when the phrase first appeared (ms),
// end = when it became final (ms). Interim (non-final) phrases are shown as-is.
export function joinSegments(segs, gapMs = 3000, lang = 'ja') {
  let out = '', prev = null;
  for (const s of segs) {
    if (!s) continue;
    const piece = s.final ? punctuate(s.text, lang) : tidy(s.text);
    if (!piece) continue;
    if (out && prev && prev.end != null && s.start - prev.end >= gapMs) out += '\n';
    else if (out && lang === 'en') out += ' ';
    out += piece; prev = s;
  }
  return out;
}

// The user edited the text while recording. Their text becomes the new base and only results from
// the returned index on are rendered after it. If the edit left the trailing interim phrase intact,
// it is cut from the base so it is not duplicated when it becomes final; otherwise the interim
// phrase counts as kept by the user (its later corrections are dropped rather than duplicated).
export function rebase(value, segs, from = 0, lang = 'ja') {
  const live = segs.slice(from);
  const k = live.findIndex((s) => s && !s.final);
  if (k < 0) return { base: value, from: segs.length };
  const tail = joinSegments(live, 3000, lang).slice(joinSegments(live.slice(0, k), 3000, lang).length);
  if (tail && value.endsWith(tail)) return { base: value.slice(0, value.length - tail.length), from: from + k };
  return { base: value, from: segs.length };
}
