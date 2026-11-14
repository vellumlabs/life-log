// Capture date of a photo file (JPEG APP1 or HEIC Exif item): Blob in, 'YYYY-MM-DD' or null out.
// Read before the canvas re-encode (which drops EXIF, including GPS). The HEIC Exif item may sit past the first 128 KB, so it is a 2nd read.
export async function fileDate(blob) {
  const head = await blob.slice(0, 131072).arrayBuffer();
  const d = exifDate(head); if (d) return d;
  const span = heicExifSpan(head); if (!span) return null;
  return exifItemDate(await blob.slice(span[0], span[0] + Math.min(span[1], 262144)).arrayBuffer());
}

// Capture date from a JPEG's EXIF (DateTimeOriginal, else DateTime). Pure: ArrayBuffer in, 'YYYY-MM-DD' or null out. PNG → null.
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

// HEIC/HEIF (ISO BMFF): ftyp, then meta → iinf (item of type 'Exif') + iloc (where its bytes are). Returns [fileOffset, length] or null.
export function heicExifSpan(buf) {
  const v = new DataView(buf), n = v.byteLength, u32 = (p) => v.getUint32(p);
  const str = (p) => String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3));
  const boxes = (from, to) => { // [[type, payloadStart, end]]; stops at anything out of range
    const out = []; let o = from;
    while (o + 8 <= to) { const s = u32(o); if (s < 8 || o + s > to) break; out.push([str(o + 4), o + 8, o + s]); o += s; }
    return out;
  };
  if (n < 12 || str(4) !== 'ftyp' || !/^(hei[cfsx]|hev[cx]|mif1|msf1|avif)$/.test(str(8))) return null;
  const meta = boxes(0, n).find((b) => b[0] === 'meta'); if (!meta) return null; // meta larger than the slice → no
  const kids = boxes(meta[1] + 4, meta[2]); // meta is a FullBox
  const iinf = kids.find((b) => b[0] === 'iinf'), iloc = kids.find((b) => b[0] === 'iloc'); if (!iinf || !iloc) return null;
  let id = null;
  for (const e of boxes(iinf[1] + 4 + (v.getUint8(iinf[1]) === 0 ? 2 : 4), iinf[2])) {
    const ver = v.getUint8(e[1]); if (e[0] !== 'infe' || ver < 2) continue;
    const p = e[1] + 4, itemId = ver === 2 ? v.getUint16(p) : u32(p), tp = p + (ver === 2 ? 2 : 4) + 2;
    if (tp + 4 <= e[2] && str(tp) === 'Exif') { id = itemId; break; }
  }
  if (id === null) return null;
  let p = iloc[1]; const ver = v.getUint8(p), end = iloc[2]; p += 4;
  if (p + 2 > end) return null;
  const os = v.getUint8(p) >> 4, ls = v.getUint8(p) & 15, bs = v.getUint8(p + 1) >> 4, is = ver ? v.getUint8(p + 1) & 15 : 0; p += 2;
  const num = (size) => { if (p + size > end) throw 0; const x = size === 8 ? u32(p) * 2 ** 32 + u32(p + 4) : size === 4 ? u32(p) : size === 2 ? v.getUint16(p) : 0; p += size; return x; };
  try {
    const count = num(ver < 2 ? 2 : 4);
    for (let i = 0; i < count; i++) {
      const itemId = num(ver < 2 ? 2 : 4), method = ver ? num(2) & 15 : 0; num(2); // data_reference_index
      const base = num(bs), ext = num(2); let first = null;
      for (let k = 0; k < ext; k++) { num(is); const off = num(os), len = num(ls); if (!first) first = [base + off, len]; }
      if (itemId === id) return method === 0 && first && first[1] > 0 ? first : null; // idat/item construction: not used by cameras
    }
  } catch { /* truncated */ }
  return null;
}

// HEIF Exif item payload: 4-byte offset to the TIFF header (after an optional "Exif\0\0"), then TIFF.
export function exifItemDate(buf) {
  const v = new DataView(buf); if (v.byteLength < 4) return null;
  const t = 4 + v.getUint32(0); return t < v.byteLength ? tiffDate(v, t, v.byteLength) : null;
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
