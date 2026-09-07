import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventsPublisher } from '../events/events.publisher.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsPublisher,
  ) {}

  async create(workspaceId: string, userId: string, dto: CreateTaskDto) {
    await this.assertMember(workspaceId, userId);
    if (dto.assignedTo) {
      await this.assertMember(workspaceId, dto.assignedTo);
    }

    const task = await this.prisma.task.create({
      data: {
        workspaceId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assignedTo: dto.assignedTo,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        createdBy: userId,
      },
    });

    this.events.created({
      workspaceId,
      taskId: task.id,
      actorId: userId,
      occurredAt: new Date().toISOString(),
      task,
    });

    return task;
  }

  async findAll(workspaceId: string, userId: string, query: QueryTasksDto) {
    await this.assertMember(workspaceId, userId);

    const tasks = await this.prisma.task.findMany({
      where: {
        workspaceId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.assignedTo ? { assignedTo: query.assignedTo } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.enrichTasks(tasks);
  }

  async findOne(workspaceId: string, taskId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    const task = await this.getTaskInWorkspace(workspaceId, taskId);
    return this.enrichTasks([task]).then((t) => t[0]);
  }

  async update(
    workspaceId: string,
    taskId: string,
    userId: string,
    dto: UpdateTaskDto,
  ) {
    await this.assertMember(workspaceId, userId);
    await this.getTaskInWorkspace(workspaceId, taskId);

    if (dto.assignedTo) {
      await this.assertMember(workspaceId, dto.assignedTo);
    }

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.assignedTo !== undefined ? { assignedTo: dto.assignedTo } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
      },
    });

    this.events.updated({
      workspaceId,
      taskId: task.id,
      actorId: userId,
      occurredAt: new Date().toISOString(),
      task,
    });

    return task;
  }

  async remove(workspaceId: string, taskId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    await this.getTaskInWorkspace(workspaceId, taskId);

    await this.prisma.task.delete({ where: { id: taskId } });

    this.events.deleted({
      workspaceId,
      taskId,
      actorId: userId,
      occurredAt: new Date().toISOString(),
    });
  }

  private async enrichTasks(
    tasks: { id: string; assignedTo: string | null; createdBy: string }[],
  ) {
    const userIds = [
      ...new Set(
        tasks.flatMap((t) => [t.assignedTo, t.createdBy]).filter(Boolean),
      ),
    ] as string[];
    if (userIds.length === 0) {
      return tasks.map((t) => ({
        ...t,
        assignedUser: null,
        createdByUser: null,
      }));
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));
    return tasks.map((t) => ({
      ...t,
      assignedUser: t.assignedTo ? (userById.get(t.assignedTo) ?? null) : null,
      createdByUser: userById.get(t.createdBy) ?? null,
    }));
  }

  private async assertMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this workspace');
    }
  }

  private async getTaskInWorkspace(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.workspaceId !== workspaceId) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }
}
