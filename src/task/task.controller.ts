import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TaskService } from './task.service.js';

@Controller('workspaces/:workspaceId/tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateTaskDto,
    @Session() session: UserSession,
  ) {
    return this.taskService.create(workspaceId, session.user.id, dto);
  }

  @Get()
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryTasksDto,
    @Session() session: UserSession,
  ) {
    return this.taskService.findAll(workspaceId, session.user.id, query);
  }

  @Get(':taskId')
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Session() session: UserSession,
  ) {
    return this.taskService.findOne(workspaceId, taskId, session.user.id);
  }

  @Patch(':taskId')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @Session() session: UserSession,
  ) {
    return this.taskService.update(workspaceId, taskId, session.user.id, dto);
  }

  @Delete(':taskId')
  @HttpCode(204)
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Session() session: UserSession,
  ) {
    return this.taskService.remove(workspaceId, taskId, session.user.id);
  }
}
