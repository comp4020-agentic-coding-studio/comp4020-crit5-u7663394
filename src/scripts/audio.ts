// A very small synth. No files, so nothing to host, nothing to 404 on the
// deployed URL, and no wait before the first sound.
//
// The pitch climbs a pentatonic ladder as the tower does, which is the one bit
// of audio design here that is doing real work: it tells the player how they
// are going without a word of text, and it is the reason a good run *sounds*
// like a good run. C5 forbids instructions; it does not forbid feedback.
//
// Nothing is created until the first gesture. An AudioContext built at load is
// born suspended under the autoplay policy, and the `resume()` below stays even
// though Chrome auto-resumes on a trusted gesture whether you ask or not ---
// C4's falsification proved the probe could not catch its absence, and it is
// load-bearing on Safari and iOS, where nothing in this repo tests.

let context: AudioContext | null = null;
let master: GainNode | null = null;

/** Pentatonic, so every interval the tower can produce is a consonant one. */
const LADDER = [0, 2, 4, 7, 9];

function semitoneFor(step: number): number {
  return LADDER[step % LADDER.length] + 12 * Math.floor(step / LADDER.length);
}

function hz(semitone: number): number {
  return 220 * 2 ** (semitone / 12);
}

/** Called from the input handler, which is the only trusted-gesture path here. */
export function unlock(): void {
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.18;
    master.connect(context.destination);
  }
  if (context.state === "suspended") void context.resume();
}

function tone(
  wave: OscillatorType,
  frequency: number,
  at: number,
  length: number,
  level: number,
): void {
  if (!context || !master) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(frequency, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(master);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

function noise(at: number, length: number, level: number, cutoff: number): void {
  if (!context || !master) return;
  const frames = Math.floor(context.sampleRate * length);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  const gain = context.createGain();
  gain.gain.value = level;
  source.connect(filter).connect(gain).connect(master);
  source.start(at);
}

/** A slab landing. `height` is how many are now stacked; `clean` means no trim. */
export function place(height: number, clean: boolean): void {
  if (!context) return;
  const now = context.currentTime;
  const root = hz(semitoneFor(height));
  tone("triangle", root, now, clean ? 0.34 : 0.16, clean ? 0.5 : 0.32);
  if (clean) {
    // The reward chime: an octave and a fifth above, quiet, a hair late.
    tone("sine", root * 3, now + 0.02, 0.5, 0.16);
  }
}

/** The overhang shearing off and tumbling away. */
export function shear(): void {
  if (!context) return;
  noise(context.currentTime, 0.2, 0.5, 1800);
}

export function miss(): void {
  if (!context) return;
  const now = context.currentTime;
  noise(now, 0.45, 0.7, 500);
  tone("sawtooth", 110, now, 0.5, 0.22);
  tone("sine", 55, now + 0.04, 0.7, 0.3);
}

export function win(): void {
  if (!context) return;
  const now = context.currentTime;
  [0, 4, 7, 12, 16, 19].forEach((semitone, i) => {
    tone("triangle", hz(semitone + 12), now + i * 0.09, 0.7, 0.4);
  });
}
