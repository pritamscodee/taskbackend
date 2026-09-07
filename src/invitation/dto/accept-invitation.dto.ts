import {
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class AcceptInvitationDto {
  @IsOptional()
  @ValidateIf(
    (data: { invitationId?: string; token?: string }) => !data.invitationId,
  )
  @IsString()
  @MinLength(24)
  token?: string;

  @IsOptional()
  @ValidateIf((data: { invitationId?: string; token?: string }) => !data.token)
  @IsUUID()
  invitationId?: string;
}
