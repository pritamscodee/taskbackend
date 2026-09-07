import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { auth } from './auth/auth.js';
import { EventsModule } from './events/events.module.js';
import { InvitationModule } from './invitation/invitation.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { TaskModule } from './task/task.module.js';
import { WorkspaceModule } from './workspace/workspace.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule.forRoot({ auth }),
    EventsModule,
    RealtimeModule,
    TaskModule,
    WorkspaceModule,
    InvitationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
