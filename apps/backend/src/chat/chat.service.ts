import { Injectable, Sse } from "@nestjs/common";
import { runAgentStream } from "@langchain-rag/ai-engine";
import { ChatDto } from "./dto/chat.dto";

@Injectable()
export class ChatService {
  create(chatDto: ChatDto) {
    return "This action adds a new chat";
  }

  findAll() {
    return `This action returns all chat`;
  }

  // ai 聊天
  @Sse("chat")
  async aiChat(chatDto: ChatDto) {
    // 调用 ai 聊天服务
    return await runAgentStream(chatDto.prompt);
  }
}
