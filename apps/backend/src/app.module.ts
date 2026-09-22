import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ChatModule } from "./chat/chat.module";
import { ConversationModule } from "./conversation/conversation.module";
import { MessageModule } from "./message/message.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { PrismaModule } from "./prisma/prisma.module";
import { EventsController } from "./task/events.controller";
import { EventsGateway } from "./task/events.gateway";
import { TaskListener } from "./task/task.listener";

@Module({
  imports: [
    // 事件总线：创建全局 EventEmitter2 实例，@OnEvent 监听器绑定到它
    // （main.ts 会把这个实例 setEventBus 注入 shared，供 ai-engine emit）
    EventEmitterModule.forRoot({ global: true }),
    PrismaModule,
    AuthModule,
    ConversationModule,
    MessageModule,
    ChatModule,
    KnowledgeModule,
  ],
  controllers: [AppController, EventsController],
  // TaskListener 打结构化日志；EventsGateway 把同一批事件多播给 SSE 前端
  providers: [AppService, TaskListener, EventsGateway],
})
export class AppModule {}
