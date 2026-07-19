import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Exceptions } from "../common/exceptions/business.exception";
import { ErrorCode } from "@langchain-rag/shared";
import type {
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
  CreateDocumentDto,
} from "./dto/knowledge.dto";

/**
 * 将文本按段落切分为简单切片（不调用 AI，仅按空行分隔）
 */
function splitTextToChunks(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * 根据文件名推断文件类型
 */
function getFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "txt";
  return ext;
}

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================================================
  // 知识库 CRUD
  // ==========================================================================

  /** 创建知识库 */
  async create(userId: number, dto: CreateKnowledgeBaseDto) {
    return this.prisma.knowledgeBase.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  /** 获取用户的知识库列表（正常 + 归档） */
  async list(userId: number) {
    return this.prisma.knowledgeBase.findMany({
      where: { userId, status: { in: [1, 2] } },
      orderBy: { updatedAt: "desc" },
    });
  }

  /** 获取单个知识库 */
  async get(id: number) {
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id } });
    if (!kb) throw Exceptions.notFound(ErrorCode.KNOWLEDGE_BASE_NOT_FOUND, "知识库不存在");
    return kb;
  }

  /** 更新知识库 */
  async update(id: number, userId: number, dto: UpdateKnowledgeBaseDto) {
    await this.get(id); // 确保存在
    return this.prisma.knowledgeBase.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  /** 软删除知识库（级联软删文档） */
  async delete(id: number, userId: number) {
    await this.get(id);
    // 级联软删文档
    await this.prisma.knowledgeDocument.updateMany({
      where: { knowledgeBaseId: id },
      data: { status: 3 },
    });
    return this.prisma.knowledgeBase.update({
      where: { id },
      data: { status: 3 },
    });
  }

  // ==========================================================================
  // 文档 CRUD
  // ==========================================================================

  /** 获取知识库下的文档列表 */
  async getDocuments(kbId: number, userId: number) {
    await this.get(kbId);
    return this.prisma.knowledgeDocument.findMany({
      where: { knowledgeBaseId: kbId, userId, status: { in: [1, 2] } },
      orderBy: { createdAt: "desc" },
    });
  }

  /** 新建文档（Markdown 内容）+ 简单切片 */
  async createDocument(kbId: number, userId: number, dto: CreateDocumentDto) {
    await this.get(kbId);

    const fileType = getFileType(dto.fileName);
    const chunks = splitTextToChunks(dto.content);
    const fileSize = Buffer.byteLength(dto.content, "utf-8");

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        knowledgeBaseId: kbId,
        userId,
        fileName: dto.fileName,
        fileType,
        fileSize,
        content: dto.content,
        chunkCount: chunks.length,
        status: 1,
      },
    });

    // 写入切片
    if (chunks.length > 0) {
      await this.prisma.knowledgeChunk.createMany({
        data: chunks.map((content, i) => ({
          documentId: doc.id,
          kbId,
          index: i + 1,
          content,
          tokenCount: Math.ceil(content.length / 2),
        })),
      });
    }

    // 更新知识库文档计数
    await this.prisma.knowledgeBase.update({
      where: { id: kbId },
      data: {
        documentCount: { increment: 1 },
        chunkCount: { increment: chunks.length },
      },
    });

    return doc;
  }

  /** 获取文档切片 */
  async getDocumentChunks(docId: number) {
    return this.prisma.knowledgeChunk.findMany({
      where: { documentId: docId },
      orderBy: { index: "asc" },
    });
  }

  /** 上传文件 */
  async uploadDocument(
    kbId: number,
    userId: number,
    file: { fileName: string; content: string; size: number },
  ) {
    await this.get(kbId);

    const fileType = getFileType(file.fileName);
    const chunks = splitTextToChunks(file.content);

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        knowledgeBaseId: kbId,
        userId,
        fileName: file.fileName,
        fileType,
        fileSize: file.size,
        content: file.content,
        chunkCount: chunks.length,
        status: 1,
      },
    });

    // 写入切片
    if (chunks.length > 0) {
      await this.prisma.knowledgeChunk.createMany({
        data: chunks.map((content, i) => ({
          documentId: doc.id,
          kbId,
          index: i + 1,
          content,
          tokenCount: Math.ceil(content.length / 2),
        })),
      });
    }

    // 更新知识库文档计数
    await this.prisma.knowledgeBase.update({
      where: { id: kbId },
      data: {
        documentCount: { increment: 1 },
        chunkCount: { increment: chunks.length },
      },
    });

    return doc;
  }

  /** 软删除文档 */
  async deleteDocument(docId: number, userId: number) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: docId } });
    if (!doc) throw Exceptions.notFound(ErrorCode.DOCUMENT_NOT_FOUND, "文档不存在");

    // 级联软删切片
    await this.prisma.knowledgeChunk.deleteMany({ where: { documentId: docId } });

    // 更新知识库计数
    await this.prisma.knowledgeBase.update({
      where: { id: doc.knowledgeBaseId },
      data: {
        documentCount: { decrement: 1 },
        chunkCount: { decrement: doc.chunkCount },
      },
    });

    return this.prisma.knowledgeDocument.delete({ where: { id: docId } });
  }
}
