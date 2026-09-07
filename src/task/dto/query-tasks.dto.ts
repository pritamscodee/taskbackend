import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TaskStatus } from '../../generated/prisma/enums.js';

export class QueryTasksDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}
