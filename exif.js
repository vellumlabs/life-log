// Capture date from a JPEG's EXIF (DateTimeOriginal, else DateTime). Pure: ArrayBuffer in, 'YYYY-MM-DD' or null out.
// Read before the canvas re-encode (which drops EXIF, including GPS). HEIC and PNG have no JPEG APP1, so they return null.
export function exifDate(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
  let o = 2;
  while (o + 4 <= v.byteLength) {
    const m = v.getUint16(o); if ((m & 0xff00) !== 0xff00 || m === 0xffda) return null; // SOS: no more metadata
    const len = v.getUint16(o + 2);
    if (m === 0xffe1 && o + 10 <= v.byteLength && v.getUint32(o + 4) === 0x45786966) return tiffDate(v, o + 10, Math.min(v.byteLength, o + 2 + len));
    o += 2 + len;
  }
  return null;
}

function tiffDate(v, t, end) {
  if (t + 8 > end) return null;
  const le = v.getUint16(t) === 0x4949; if (!le && v.getUint16(t) !== 0x4d4d) return null;
  const u16 = (p) => v.getUint16(p, le), u32 = (p) => v.getUint32(p, le);
  const tags = (ifd) => { // {tag: absolute offset of the 12-byte entry}
    const out = {}, p = t + ifd; if (p + 2 > end) return out;
    const n = u16(p); for (let i = 0; i < n && p + 2 + i * 12 + 12 <= end; i++) out[u16(p + 2 + i * 12)] = p + 2 + i * 12;
    return out;
  };
  const ascii = (e) => { // type 2, count ≥ 19 ("YYYY:MM:DD HH:MM:SS")
    if (!e || u16(e + 2) !== 2 || u32(e + 4) < 19) return null;
    const p = t + u32(e + 8); if (p + 19 > end) return null;
    let s = ''; for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(p + i));
    return s;
  };
  const ifd0 = tags(u32(t + 4));
  const exif = ifd0[0x8769] ? tags(u32(ifd0[0x8769] + 8)) : {};
  for (const s of [ascii(exif[0x9003]), ascii(exif[0x9004]), ascii(ifd0[0x0132])]) {
    const m = s && s.match(/^(\d{4}):(\d{2}):(\d{2}) /);
    if (m && m[1] !== '0000' && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

// The date to suggest for the entry: the day most photos were taken (ties → the later day), unless it is already set.
export function suggestDate(dates, current) {
  const n = {}; for (const d of dates) if (d) n[d] = (n[d] || 0) + 1;
  const best = Object.keys(n).sort((a, b) => n[b] - n[a] || (a < b ? 1 : -1))[0];
  return best && best !== current ? best : null;
}
