import { Module } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";
import { ConversationModule } from "../conversation/conversation.module";
import { MessageModule } from "../message/message.module";

@Module({
  imports: [ConversationModule, MessageModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
