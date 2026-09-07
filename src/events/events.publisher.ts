import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
  EVENTS_SERVICE,
  TaskEventPattern,
  WorkspaceEventPattern,
  type EventPattern,
} from './events.constants.js';
import type { TaskEventPayload } from './task-event.js';
import type { MemberAddedPayload } from './workspace-event.js';

@Injectable()
export class EventsPublisher implements OnModuleInit {
  private readonly logger = new Logger(EventsPublisher.name);

  constructor(@Inject(EVENTS_SERVICE) private readonly client: ClientProxy) {}

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn(
        `RabbitMQ client did not connect: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  created(payload: TaskEventPayload) {
    this.emit(TaskEventPattern.Created, payload);
  }

  updated(payload: TaskEventPayload) {
    this.emit(TaskEventPattern.Updated, payload);
  }

  deleted(payload: TaskEventPayload) {
    this.emit(TaskEventPattern.Deleted, payload);
  }

  memberAdded(payload: MemberAddedPayload) {
    this.emit(WorkspaceEventPattern.MemberAdded, payload);
  }

  private emit(
    pattern: EventPattern,
    payload: TaskEventPayload | MemberAddedPayload,
  ) {
    try {
      this.client.emit(pattern, payload).subscribe({
        error: (error: unknown) => {
          this.logger.warn(
            `Failed to publish ${pattern}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to publish ${pattern}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
