import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  TaskEventPattern,
  WorkspaceEventPattern,
} from '../events/events.constants.js';
import type { TaskEventPayload } from '../events/task-event.js';
import type { MemberAddedPayload } from '../events/workspace-event.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Controller()
export class RealtimeConsumer {
  constructor(private readonly gateway: RealtimeGateway) {}

  @EventPattern(TaskEventPattern.Created)
  handleCreated(@Payload() payload: TaskEventPayload) {
    this.gateway.broadcast(TaskEventPattern.Created, payload);
  }

  @EventPattern(TaskEventPattern.Updated)
  handleUpdated(@Payload() payload: TaskEventPayload) {
    this.gateway.broadcast(TaskEventPattern.Updated, payload);
  }

  @EventPattern(TaskEventPattern.Deleted)
  handleDeleted(@Payload() payload: TaskEventPayload) {
    this.gateway.broadcast(TaskEventPattern.Deleted, payload);
  }

  @EventPattern(WorkspaceEventPattern.MemberAdded)
  handleMemberAdded(@Payload() payload: MemberAddedPayload) {
    this.gateway.broadcast(WorkspaceEventPattern.MemberAdded, payload);
  }
}
