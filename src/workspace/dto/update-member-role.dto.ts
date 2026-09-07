import { IsEnum } from 'class-validator';
import { WorkspaceRole } from '../../generated/prisma/enums.js';

export class UpdateMemberRoleDto {
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;
}
