/**
 * Calculates the exponential backoff delay.
 * 
 * @param attempt - The current attempt number (0-indexed).
 * @param base - The base delay in milliseconds.
 * @param max - The maximum delay in milliseconds.
 * @returns The calculated delay in milliseconds.
 */
export function getDelay(attempt: number, base: number, max: number): number {
  const delay = base * Math.pow(2, attempt);
  return Math.min(delay, max);
}
