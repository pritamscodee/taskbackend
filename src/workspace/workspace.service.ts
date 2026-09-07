import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          ownerId: userId,
        },
      });
      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: 'OWNER',
        },
      });
      return workspace;
    });
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'desc' },
      include: { workspace: true },
    });
    const ownerIds = [...new Set(memberships.map((m) => m.workspace.ownerId))];
    const owners = await this.prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, name: true },
    });
    const ownerById = new Map(owners.map((o) => [o.id, o]));
    return memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
      joinedAt: m.joinedAt,
      owner: ownerById.get(m.workspace.ownerId) ?? null,
    }));
  }

  async findOne(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    return workspace;
  }

  async findMembers(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: 'asc' },
    });
    const userIds = [...new Set(members.map((m) => m.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));
    return members.map((m) => ({
      ...m,
      user: userById.get(m.userId) ?? null,
    }));
  }

  async update(workspaceId: string, userId: string, dto: UpdateWorkspaceDto) {
    await this.assertRole(workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.MANAGER,
    ]);
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: dto.name },
    });
  }

  async remove(workspaceId: string, userId: string) {
    await this.assertRole(workspaceId, userId, [WorkspaceRole.OWNER]);
    await this.prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({ where: { workspaceId } });
      await tx.workspaceInvitation.deleteMany({ where: { workspaceId } });
      await tx.workspaceMember.deleteMany({ where: { workspaceId } });
      await tx.workspace.delete({ where: { id: workspaceId } });
    });
  }

  async updateMemberRole(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    await this.assertRole(workspaceId, actorId, [WorkspaceRole.OWNER]);
    if (actorId === targetUserId) {
      throw new ForbiddenException(
        'You cannot change your own role. Transfer ownership instead.',
      );
    }
    const target = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUserId },
      },
    });
    if (!target) {
      throw new NotFoundException('Member not found');
    }
    if (
      target.role === WorkspaceRole.OWNER &&
      dto.role !== WorkspaceRole.OWNER
    ) {
      throw new ForbiddenException('Cannot change the workspace owner role');
    }
    return this.prisma.workspaceMember.update({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUserId },
      },
      data: { role: dto.role },
    });
  }

  async removeMember(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
  ) {
    const actor = await this.assertRole(workspaceId, actorId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.MANAGER,
    ]);
    const target = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUserId },
      },
    });
    if (!target) {
      throw new NotFoundException('Member not found');
    }
    if (target.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Cannot remove a workspace owner');
    }
    const isSelf = actorId === targetUserId;
    const actorRole = actor.role;
    const canRemove =
      isSelf ||
      actorRole === WorkspaceRole.OWNER ||
      (actorRole === WorkspaceRole.MANAGER &&
        target.role === WorkspaceRole.MEMBER);
    if (!canRemove) {
      throw new ForbiddenException(
        'You do not have permission to remove this member',
      );
    }
    await this.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUserId },
      },
    });
  }

  private async assertMember(workspaceId: string, userId: string) {
    await this.assertRole(workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.MANAGER,
      WorkspaceRole.MEMBER,
    ]);
  }

  private async assertRole(
    workspaceId: string,
    userId: string,
    roles: WorkspaceRole[],
  ) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    if (!roles.includes(member.role)) {
      throw new ForbiddenException(
        'You do not have permission for this action',
      );
    }
    return member;
  }
}
