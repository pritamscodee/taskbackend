import { IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { WorkspaceRole } from '../../generated/prisma/enums.js';

export class CreateInvitationDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;
}
