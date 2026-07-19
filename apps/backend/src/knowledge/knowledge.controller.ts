import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { KnowledgeService } from "./knowledge.service";
import { CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto, CreateDocumentDto } from "./dto/knowledge.dto";
// TODO: 临时跳过登录校验
// import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("api/knowledge")
// TODO: 临时跳过登录校验
// @UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  // ==========================================================================
  // 知识库
  // ==========================================================================

  @Get()
  async list(@CurrentUser() user: { id: number }) {
    return this.knowledgeService.list(user.id);
  }

  @Post()
  async create(@CurrentUser() user: { id: number }, @Body() dto: CreateKnowledgeBaseDto) {
    return this.knowledgeService.create(user.id, dto);
  }

  @Get(":id")
  async get(@Param("id", ParseIntPipe) id: number) {
    return this.knowledgeService.get(id);
  }

  @Patch(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateKnowledgeBaseDto,
  ) {
    return this.knowledgeService.update(id, user.id, dto);
  }

  @Delete(":id")
  async delete(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.knowledgeService.delete(id, user.id);
  }

  // ==========================================================================
  // 文档
  // ==========================================================================

  @Get(":id/documents")
  async getDocuments(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.knowledgeService.getDocuments(id, user.id);
  }

  @Post(":id/documents")
  async createDocument(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
    @Body() dto: CreateDocumentDto,
  ) {
    return this.knowledgeService.createDocument(id, user.id, dto);
  }

  @Post(":id/upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocument(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
    @UploadedFile() file: { buffer: Buffer; originalname: string; size: number },
  ) {
    const content = file.buffer.toString("utf-8");
    return this.knowledgeService.uploadDocument(id, user.id, {
      fileName: file.originalname,
      content,
      size: file.size,
    });
  }

  @Get(":id/documents/:docId/chunks")
  async getDocumentChunks(
    @Param("id", ParseIntPipe) _id: number,
    @Param("docId", ParseIntPipe) docId: number,
  ) {
    return this.knowledgeService.getDocumentChunks(docId);
  }

  @Delete(":id/documents/:docId")
  async deleteDocument(
    @Param("id", ParseIntPipe) _id: number,
    @Param("docId", ParseIntPipe) docId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.knowledgeService.deleteDocument(docId, user.id);
  }
}
