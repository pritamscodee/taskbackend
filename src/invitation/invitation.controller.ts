import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { InvitationService } from './invitation.service.js';

@Controller()
export class InvitationController {
  constructor(private readonly invitations: InvitationService) {}

  @Post('workspaces/:workspaceId/invitations')
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateInvitationDto,
    @Session() session: UserSession,
  ) {
    return this.invitations.create(workspaceId, session.user.id, dto);
  }

  @Get('workspaces/:workspaceId/invitations')
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Session() session: UserSession,
  ) {
    return this.invitations.findAll(workspaceId, session.user.id);
  }

  @Delete('workspaces/:workspaceId/invitations/:invitationId')
  @HttpCode(204)
  revoke(
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
    @Session() session: UserSession,
  ) {
    return this.invitations.revoke(workspaceId, invitationId, session.user.id);
  }

  @Get('invitations/me')
  me(@Session() session: UserSession) {
    return this.invitations.pendingForUser(session.user);
  }

  @Post('invitations/accept')
  accept(@Body() dto: AcceptInvitationDto, @Session() session: UserSession) {
    return this.invitations.accept(session.user, dto);
  }

  @Delete('invitations/me/:invitationId')
  @HttpCode(204)
  decline(
    @Param('invitationId') invitationId: string,
    @Session() session: UserSession,
  ) {
    return this.invitations.decline(session.user, invitationId);
  }
}
