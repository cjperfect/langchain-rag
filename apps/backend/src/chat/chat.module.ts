import { Module } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";
import { ConversationModule } from "../conversation/conversation.module";
import { MessageModule } from "../message/message.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [ConversationModule, MessageModule, PrismaModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
