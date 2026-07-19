import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ChatModule } from "./chat/chat.module";
import { ConversationModule } from "./conversation/conversation.module";
import { MessageModule } from "./message/message.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, AuthModule, ConversationModule, MessageModule, ChatModule, KnowledgeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
