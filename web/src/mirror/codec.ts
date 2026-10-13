// A batch of a recording, packed for the trip from the recorder (src/mirror/recorder.ts) to a
// screen's page (src/screen). It crosses Lua and the network as ONE string that nothing in between
// opens: a JSON document sent through Lua tables would come back with its empty arrays turned into
// objects and its nulls gone. Small batches travel as they are, larger ones gzipped.
//   'j' + json            'z' + base64(gzip(json))

/** Browser dev: the tab running the OS and the tab running a screen talk over this channel. */
export const DEV_CHANNEL = 'sd-computers-mirror';

/** What the recorder hands to Lua (and, in browser dev, to the channel). */
export interface Batch {
  /** The batch's place in the recording. */
  seq: number;
  /** It is a whole-screen snapshot: a page can start from it. */
  full: boolean;
  blob: string;
}

const MIN_GZIP = 1024;
const CHUNK = 0x8000;

const canGzip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export async function pack(json: string): Promise<string> {
  if (!canGzip || json.length < MIN_GZIP) return 'j' + json;
  return 'z' + toBase64(await through(new TextEncoder().encode(json), new CompressionStream('gzip')));
}

export async function unpack(blob: string): Promise<string> {
  if (blob[0] !== 'z') return blob.slice(1);
  return new TextDecoder().decode(await through(fromBase64(blob.slice(1)), new DecompressionStream('gzip')));
}
