import { Controller, Get, Post, Param, Body, Query, UseGuards, ParseIntPipe } from "@nestjs/common";
import { MessageService } from "./message.service";
import { SendMessageDto, EditMessageDto, SwitchBranchDto } from "./dto/message.dto";
// TODO: 临时跳过登录校验
// import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("api")
// TODO: 临时跳过登录校验
// @UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get("conversations/:convId/messages")
  async getBranchMessages(
    @Param("convId", ParseIntPipe) convId: number,
    @Query("rootId") rootId?: string,
  ) {
    return this.messageService.getBranchMessages(convId, rootId ? Number(rootId) : undefined);
  }

  @Post("conversations/:convId/messages")
  async sendMessage(
    @CurrentUser() user: { id: number },
    @Param("convId", ParseIntPipe) convId: number,
    @Body() dto: SendMessageDto,
  ) {
    return this.messageService.createUserMessage(user.id, convId, dto);
  }

  @Post("messages/:id/edit")
  async editMessage(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: EditMessageDto,
  ) {
    return this.messageService.editMessage(id, dto);
  }

  @Get("messages/:id/branches")
  async getBranches(@Param("id", ParseIntPipe) id: number) {
    return this.messageService.getBranches(id);
  }

  @Post("conversations/:convId/switch-branch")
  async switchBranch(
    @Param("convId", ParseIntPipe) convId: number,
    @Body() dto: SwitchBranchDto,
  ) {
    return this.messageService.switchBranch(convId, dto.messageId);
  }
}
