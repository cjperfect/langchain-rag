import { Injectable } from "@nestjs/common";
import { ChatDto } from "./dto/chat.dto";
import { AiEngine } from "@langchain-rag/ai-engine";

@Injectable()
export class ChatService {
  private readonly aiEngine = new AiEngine();
  create(chatDto: ChatDto) {
    return "This action adds a new chat";
  }

  findAll() {
    return `This action returns all chat`;
  }

  async aiChat(chatDto: ChatDto) {
    // 调用 ai 聊天服务
    return await this.aiEngine.stream(chatDto.prompt);
  }
}
