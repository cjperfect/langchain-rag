import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { ConversationService } from "./conversation.service";
import { CreateConversationDto, UpdateConversationDto, GenerateTitleDto } from "./dto/conversation.dto";
// TODO: 临时跳过登录校验
// import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("api/conversations")
// TODO: 临时跳过登录校验
// @UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  async create(@CurrentUser() user: { id: number }, @Body() dto: CreateConversationDto) {
    return this.conversationService.create(user.id, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: { id: number },
    @Query("knowledge_id") knowledgeId?: string,
  ) {
    return this.conversationService.list(user.id, knowledgeId ? Number(knowledgeId) : undefined);
  }

  @Get(":id")
  async get(@Param("id", ParseIntPipe) id: number) {
    return this.conversationService.get(id);
  }

  @Patch(":id")
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateConversationDto) {
    return this.conversationService.update(id, dto);
  }

  @Delete(":id")
  async delete(@Param("id", ParseIntPipe) id: number) {
    return this.conversationService.delete(id);
  }

  @Post(":id/generate-title")
  async generateTitle(@Param("id", ParseIntPipe) id: number, @Body() dto: GenerateTitleDto) {
    return this.conversationService.generateTitle(id, dto);
  }
}
