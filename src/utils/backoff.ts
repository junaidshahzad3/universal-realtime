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
    // Apply ±25% randomized jitter to stagger reconnections
    const jitterFactor = 0.75 + Math.random() * 0.5;
    return Math.round(constrainedDelay * jitterFactor);
  }

  return constrainedDelay;
}
