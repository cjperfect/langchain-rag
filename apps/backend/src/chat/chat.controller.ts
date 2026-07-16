import { Controller, Body, Res, Post } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { ChatDto } from "./dto/chat.dto";
import type { Response } from "express";

@Controller("api")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ai 聊天
  @Post("chat")
  async aiChat(@Body() chatDto: ChatDto, @Res() res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const stream = await this.chatService.aiChat(chatDto);

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify(error)}\n\n`);
    }
  }
}
