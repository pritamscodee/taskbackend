import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { EventsPublisher } from '../events/events.publisher.js';
import { WorkspaceRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = { id: string; email: string };

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function stripInvitation<T extends { tokenHash: string }>(
  invitation: T,
): Omit<T, 'tokenHash'> {
  const rest = { ...invitation };
  delete (rest as Partial<T>).tokenHash;
  return rest;
}

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsPublisher,
  ) {}

  async create(
    workspaceId: string,
    inviterId: string,
    dto: CreateInvitationDto,
  ) {
    await this.assertManager(workspaceId, inviterId);

    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      const isMember = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: existingUser.id },
        },
        select: { id: true },
      });
      if (isMember) {
        throw new ConflictException(
          'This user is already a member of the workspace',
        );
      }
    }

    const active = await this.prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (active) {
      throw new ConflictException(
        'An active invitation already exists for this email',
      );
    }

    const token = randomBytes(24).toString('base64url');
    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role: dto.role ?? WorkspaceRole.MEMBER,
        tokenHash: hashToken(token),
        invitedBy: inviterId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });

    const appUrl = process.env.APP_URL ?? 'http://localhost:3001';
    return {
      ...stripInvitation(invitation),
      token,
      inviteUrl: `${appUrl}/invite?token=${encodeURIComponent(token)}`,
    };
  }

  async findAll(workspaceId: string, userId: string) {
    await this.assertManager(workspaceId, userId);
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    return invitations.map((i) => ({
      ...stripInvitation(i),
      isAccepted: i.acceptedAt !== null,
      isExpired: i.acceptedAt === null && i.expiresAt < now,
    }));
  }

  async revoke(workspaceId: string, invitationId: string, userId: string) {
    await this.assertManager(workspaceId, userId);
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: { id: invitationId, workspaceId },
      select: { id: true },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    await this.prisma.workspaceInvitation.delete({
      where: { id: invitationId },
    });
  }

  async pendingForUser(user: SessionUser) {
    if (!user?.email) {
      return [];
    }
    const email = user.email.toLowerCase();
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
      include: {
        workspace: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map((invitation) => ({
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspace.name,
      email: invitation.email,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
    }));
  }

  async accept(user: SessionUser, dto: AcceptInvitationDto) {
    if (!dto.token && !dto.invitationId) {
      throw new BadRequestException(
        'Provide either the invitation token or invitationId',
      );
    }

    const invitation = dto.token
      ? await this.prisma.workspaceInvitation.findUnique({
          where: { tokenHash: hashToken(dto.token) },
        })
      : await this.prisma.workspaceInvitation.findUnique({
          where: { id: dto.invitationId! },
        });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.acceptedAt) {
      const member = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: user.id,
          },
        },
      });
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: invitation.workspaceId },
      });
      if (member && workspace) {
        return this.consumeResult(workspace, member);
      }
    }

    if (invitation.expiresAt < new Date()) {
      throw new GoneException('Invitation has expired');
    }

    const membership = await this.prisma.$transaction(async (tx) => {
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      const existing = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: user.id,
          },
        },
      });
      if (existing) {
        return existing;
      }
      return tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          role: invitation.role,
        },
      });
    });

    this.events.memberAdded({
      workspaceId: invitation.workspaceId,
      memberId: membership.id,
      userId: user.id,
      role: membership.role,
      actorId: invitation.invitedBy,
      occurredAt: new Date().toISOString(),
    });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: invitation.workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    return this.consumeResult(workspace, membership);
  }

  async decline(user: SessionUser, invitationId: string) {
    const email = user.email.toLowerCase();
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: { id: invitationId, email },
      select: { id: true },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    await this.prisma.workspaceInvitation.delete({
      where: { id: invitationId },
    });
  }

  private consumeResult(
    workspace: { id: string; name: string },
    member: { id: string; workspaceId: string; userId: string; role: string },
  ) {
    return { workspace, member };
  }

  private async assertManager(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    if (
      member.role !== WorkspaceRole.OWNER &&
      member.role !== WorkspaceRole.MANAGER
    ) {
      throw new ForbiddenException(
        'Only owners and managers can manage invitations',
      );
    }
    return member;
  }
}
