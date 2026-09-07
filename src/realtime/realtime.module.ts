import { Module } from '@nestjs/common';
import { RealtimeConsumer } from './realtime.consumer.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  controllers: [RealtimeConsumer],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
