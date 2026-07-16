import { Controller, Get, Post, Body } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { ChatDto } from "./dto/chat.dto";

@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // 所有聊天记录
  @Get()
  findAll() {
    return this.chatService.findAll();
  }

  // ai 聊天
  @Post("chat")
  aiChat(@Body() chatDto: ChatDto) {
    // 调用 ai 聊天服务
    return this.chatService.aiChat(chatDto);
  }
}
