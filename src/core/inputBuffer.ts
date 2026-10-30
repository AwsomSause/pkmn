// Input buffering (catalog #122): a key pressed while no screen is listening (a scene change) is kept for a moment
// and given to the next screen, so the first intended press is not lost. Pure: time is passed in.

export interface Pending<T> {
  action: T;
  at: number;
}

export class InputBuffer<T> {
  private pending: Pending<T> | null = null;
  constructor(private readonly windowMs = 300) {}

  /** A key press nobody handled. Only the latest is kept. */
  drop(action: T, now: number): void {
    this.pending = { action, at: now };
  }

  /** The kept press if it is still fresh (and forgets it either way), else null. */
  take(now: number): T | null {
    const p = this.pending;
    this.pending = null;
    return p && now - p.at <= this.windowMs ? p.action : null;
  }
}
