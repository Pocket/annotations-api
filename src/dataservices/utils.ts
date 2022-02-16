import { setTimeout } from 'timers/promises';

/**
 * Exponential backoff with full jitter.
 * @param tries number of re(tries). Used for exonential backoff
 * calculation
 * @param cap Backoff time cap, in ms. Will not back off any
 * longer than this value
 */
export async function backoff(tries: number, cap: number) {
  const maxWait = Math.min(cap, 2 ** tries * 100);
  // Pick random number from set [0, maxWait]
  const jitterWait = Math.floor(Math.random() * (maxWait + 1) + 0);
  await setTimeout(jitterWait);
}
