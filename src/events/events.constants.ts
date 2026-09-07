export const EVENTS_SERVICE = 'EVENTS_SERVICE';

export const TASKZEN_EVENTS_QUEUE = 'taskzen.events';

export const TaskEventPattern = {
  Created: 'task.created',
  Updated: 'task.updated',
  Deleted: 'task.deleted',
} as const;

export type TaskEventPattern =
  (typeof TaskEventPattern)[keyof typeof TaskEventPattern];

export const WorkspaceEventPattern = {
  MemberAdded: 'workspace.member.added',
} as const;

export type WorkspaceEventPattern =
  (typeof WorkspaceEventPattern)[keyof typeof WorkspaceEventPattern];

export type EventPattern = TaskEventPattern | WorkspaceEventPattern;
