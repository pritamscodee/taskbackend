export type TaskEventPayload = {
  workspaceId: string;
  taskId: string;
  actorId: string;
  occurredAt: string;
  task?: unknown;
};
