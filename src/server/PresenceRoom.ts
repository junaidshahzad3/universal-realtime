import type { WebSocket } from 'ws';
import type { PresenceUser } from '../types/index.js';

export interface PresenceMember {
  user: PresenceUser;
  socket: WebSocket;
}

export class PresenceRoom {
  private members = new Map<string, PresenceMember>(); // Maps userId -> PresenceMember

  constructor(public readonly roomId: string) {}

  /**
   * Adds a user to the room, triggers a 'sync' response to the new user,
   * and broadcasts a 'join' event to the other participants.
   */
  public join(user: PresenceUser, socket: WebSocket): void {
    // Add member
    this.members.set(user.id, { user, socket });

    // 1. Send current active members list to the newly joined client (sync)
    const activeUsers = this.getUsers();
    this.sendToSocket(socket, {
      type: 'sync',
      users: activeUsers,
    });

    // 2. Broadcast 'join' event to everyone else in the room
    this.broadcast({
      type: 'join',
      user,
    }, socket);
  }

  /**
   * Removes a user from the room and broadcasts a 'leave' event to other participants.
   */
  public leave(userId: string): PresenceUser | null {
    const member = this.members.get(userId);
    if (!member) return null;

    this.members.delete(userId);

    // Broadcast 'leave' event to remaining participants
    this.broadcast({
      type: 'leave',
      user: member.user,
    });

    return member.user;
  }

  /**
   * Discards a socket explicitly (e.g. on disconnect) and triggers leave if found.
   */
  public handleDisconnect(socket: WebSocket): PresenceUser | null {
    for (const [userId, member] of this.members.entries()) {
      if (member.socket === socket) {
        return this.leave(userId);
      }
    }
    return null;
  }

  /**
   * Returns a list of all active users in the room.
   */
  public getUsers(): PresenceUser[] {
    return Array.from(this.members.values()).map((m) => m.user);
  }

  /**
   * Broadcasts a JSON message to all users in the room, optionally excluding a specific socket.
   */
  public broadcast(message: any, excludeSocket?: WebSocket): void {
    const payload = JSON.stringify(message);
    for (const member of this.members.values()) {
      if (excludeSocket && member.socket === excludeSocket) {
        continue;
      }
      if (member.socket.readyState === 1) { // OPEN
        member.socket.send(payload);
      }
    }
  }

  /**
   * Sends a JSON message to a single socket safely.
   */
  private sendToSocket(socket: WebSocket, message: any): void {
    if (socket.readyState === 1) { // OPEN
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Gets the member count.
   */
  get size(): number {
    return this.members.size;
  }

  /**
   * Cleans up the room.
   */
  public clear(): void {
    this.members.clear();
  }
}
