import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';
import { WorkspaceService } from './workspace.service.js';

@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  create(@Body() dto: CreateWorkspaceDto, @Session() session: UserSession) {
    return this.workspaceService.create(session.user.id, dto);
  }

  @Get()
  findAll(@Session() session: UserSession) {
    return this.workspaceService.findAllForUser(session.user.id);
  }

  @Get(':workspaceId/members')
  findMembers(
    @Param('workspaceId') workspaceId: string,
    @Session() session: UserSession,
  ) {
    return this.workspaceService.findMembers(workspaceId, session.user.id);
  }

  @Patch(':workspaceId/members/:userId')
  updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Session() session: UserSession,
  ) {
    return this.workspaceService.updateMemberRole(
      workspaceId,
      session.user.id,
      userId,
      dto,
    );
  }

  @Delete(':workspaceId/members/:userId')
  @HttpCode(204)
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Session() session: UserSession,
  ) {
    return this.workspaceService.removeMember(
      workspaceId,
      session.user.id,
      userId,
    );
  }

  @Patch(':workspaceId')
  update(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
    @Session() session: UserSession,
  ) {
    return this.workspaceService.update(workspaceId, session.user.id, dto);
  }

  @Delete(':workspaceId')
  @HttpCode(204)
  remove(
    @Param('workspaceId') workspaceId: string,
    @Session() session: UserSession,
  ) {
    return this.workspaceService.remove(workspaceId, session.user.id);
  }

  @Get(':workspaceId')
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Session() session: UserSession,
  ) {
    return this.workspaceService.findOne(workspaceId, session.user.id);
  }
}
