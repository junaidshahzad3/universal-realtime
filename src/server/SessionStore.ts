export interface ClientSession {
  sessionId: string;
  clientId: string;
  lastSeen: number;
  messageBuffer: any[];
}

export class SessionStore {
  private sessions = new Map<string, ClientSession>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private sessionTimeoutMs = 60000) {
    this.startCleanupLoop();
  }

  /**
   * Retrieves or creates a session for the specified client.
   */
  public getOrCreateSession(sessionId: string, clientId: string): ClientSession {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        clientId,
        lastSeen: Date.now(),
        messageBuffer: [],
      };
      this.sessions.set(sessionId, session);
    } else {
      session.lastSeen = Date.now();
    }
    
    return session;
  }

  /**
   * Refreshes the last seen timestamp of a session.
   */
  public touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastSeen = Date.now();
    }
  }

  /**
   * Buffers a message for a session when a client is offline.
   */
  public bufferMessage(sessionId: string, message: any): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageBuffer.push(message);
      session.lastSeen = Date.now();
    }
  }

  /**
   * Gets and flushes the message buffer for a session.
   */
  public flushBuffer(sessionId: string): any[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const buffer = [...session.messageBuffer];
    session.messageBuffer = [];
    session.lastSeen = Date.now();
    return buffer;
  }

  /**
   * Removes a session explicitly.
   */
  public removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Starts periodic garbage collection of expired sessions.
   */
  private startCleanupLoop(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this.sessions.entries()) {
        if (now - session.lastSeen > this.sessionTimeoutMs) {
          this.sessions.delete(sessionId);
        }
      }
    }, Math.min(this.sessionTimeoutMs, 30000));
  }

  /**
   * Cleans up timer on store destruction.
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }
}
