/**
 * Calculates the exponential backoff delay.
 * 
 * @param attempt - The current attempt number (0-indexed).
 * @param base - The base delay in milliseconds.
 * @param max - The maximum delay in milliseconds.
 * @returns The calculated delay in milliseconds.
 */
export function getDelay(attempt: number, base: number, max: number, jitter = false): number {
  const delay = base * Math.pow(2, attempt);
  const constrainedDelay = Math.min(delay, max);

  if (jitter) {
    // Apply ±25% randomized jitter to stagger reconnections.
    //
    // Re-clamp afterwards: jitter used to be applied to the already-capped
    // value and returned directly, so roughly half of all delays landed above
    // `max` (up to 1.25x it) and the cap did not hold.
    const jitterFactor = 0.75 + Math.random() * 0.5;
    return Math.min(Math.round(constrainedDelay * jitterFactor), max);
  }

  return constrainedDelay;
}
