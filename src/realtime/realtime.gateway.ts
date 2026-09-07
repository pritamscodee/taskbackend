import { Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import {
  AuthGuard,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Server, Socket } from 'socket.io';
import { auth } from '../auth/auth.js';
import type { EventPattern } from '../events/events.constants.js';
import type { TaskEventPayload } from '../events/task-event.js';
import type { MemberAddedPayload } from '../events/workspace-event.js';
import { PrismaService } from '../prisma/prisma.service.js';

function workspaceRoom(workspaceId: string) {
  return `workspace:${workspaceId}`;
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
    ],
    credentials: true,
  },
})
@UseGuards(AuthGuard)
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(client.handshake.headers),
    });
    if (!session?.user?.id) {
      client.disconnect();
      return;
    }
    const socketData = client.data as { userId?: string };
    socketData.userId = session.user.id;
  }

  @SubscribeMessage('workspace:join')
  async joinWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { workspaceId?: string },
    @Session() session: UserSession,
  ) {
    const workspaceId = body?.workspaceId;
    if (!workspaceId) {
      throw new WsException('workspaceId is required');
    }

    const userId =
      session?.user?.id ?? (client.data as { userId?: string }).userId;
    await this.assertMember(workspaceId, userId);
    await client.join(workspaceRoom(workspaceId));
    return { ok: true, room: workspaceRoom(workspaceId) };
  }

  @SubscribeMessage('workspace:leave')
  async leaveWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { workspaceId?: string },
  ) {
    const workspaceId = body?.workspaceId;
    if (!workspaceId) {
      throw new WsException('workspaceId is required');
    }
    await client.leave(workspaceRoom(workspaceId));
    return { ok: true };
  }

  broadcast(
    pattern: EventPattern,
    payload: TaskEventPayload | MemberAddedPayload,
  ) {
    if (!payload?.workspaceId) {
      this.logger.warn(`Dropping ${pattern}: missing workspaceId`);
      return;
    }
    this.server?.to(workspaceRoom(payload.workspaceId)).emit(pattern, payload);
  }

  private async assertMember(workspaceId: string, userId: string | undefined) {
    if (!userId) {
      throw new WsException('UNAUTHORIZED');
    }
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
    if (!member) {
      throw new WsException('FORBIDDEN');
    }
  }
}
