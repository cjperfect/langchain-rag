import { Injectable } from "@nestjs/common";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PrismaService } from "../prisma/prisma.service";
import { Exceptions } from "../common/exceptions/business.exception";
import { CommonStatus } from "@langchain-rag/shared";
import { loadPdf, loadCsv, loadText, loadMarkdown } from "@langchain-rag/ai-engine";
import type {
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
  CreateDocumentDto,
  UpdateDocumentDto,
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
      where: { userId, status: { in: [CommonStatus.NORMAL, CommonStatus.ARCHIVED] } },
      orderBy: { updatedAt: "desc" },
    });
  }

  /** 获取单个知识库 */
  async get(id: number) {
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id } });
    if (!kb) throw Exceptions.notFound("知识库不存在");
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
      data: { status: CommonStatus.DELETED },
    });
    // 级联软删该知识库下的所有会话
    await this.prisma.chatConversation.updateMany({
      where: { knowledgeId: id },
      data: { status: CommonStatus.DELETED },
    });
    return this.prisma.knowledgeBase.update({
      where: { id },
      data: { status: CommonStatus.DELETED },
    });
  }

  // ==========================================================================
  // 文档 CRUD
  // ==========================================================================

  /** 获取知识库下的文档列表 */
  async getDocuments(kbId: number, userId: number) {
    await this.get(kbId);
    return this.prisma.knowledgeDocument.findMany({
      where: { knowledgeBaseId: kbId, userId, status: { in: [CommonStatus.NORMAL, CommonStatus.ARCHIVED] } },
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
        status: CommonStatus.NORMAL,
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
  /** 获取文档完整文本内容 */
  async getDocumentContent(docId: number) {
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { documentId: docId },
      orderBy: { index: "asc" },
    });
    return { content: chunks.map((c) => c.content).join("\n\n") };
  }

  async getDocumentChunks(docId: number) {
    return this.prisma.knowledgeChunk.findMany({
      where: { documentId: docId },
      orderBy: { index: "asc" },
    });
  }

  /** 上传文件：根据扩展名路由到对应 Loader 提取文本，再切片入库 */
  async uploadDocument(
    kbId: number,
    userId: number,
    file: { fileName: string; buffer: Buffer; size: number },
  ) {
    await this.get(kbId);

    const ext = getFileType(file.fileName);
    const tempPath = join(tmpdir(), `kb-upload-${Date.now()}-${file.fileName}`);

    try {
      // 写入临时文件（PDF/CSV loader 需要文件路径）
      writeFileSync(tempPath, file.buffer);

      // 根据文件类型选择 loader 提取文本
      const docs = await this.extractText(tempPath, ext);
      const content = docs.map((d) => d.pageContent).join("\n\n");

      // 如果 loader 未提取到任何文本，回退为原始 buffer 内容
      return this.createDocument(kbId, userId, {
        fileName: file.fileName,
        content: content.trim() || file.buffer.toString("utf-8"),
      });
    } finally {
      // 清理临时文件
      try {
        unlinkSync(tempPath);
      } catch {
        /* 忽略清理错误 */
      }
    }
  }

  /** 根据文件扩展名路由到对应的 Loader */
  private async extractText(filePath: string, ext: string) {
    switch (ext) {
      case "pdf":
        return loadPdf(filePath, { splitPages: false });
      case "csv":
        return loadCsv(filePath);
      case "md":
        return loadMarkdown(filePath);
      case "txt":
      default:
        // 代码文件及其他纯文本一律按 text 处理
        return loadText(filePath);
    }
  }

  /** 更新文档内容（重新切片） */
  async updateDocument(docId: number, userId: number, dto: UpdateDocumentDto) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: docId } });
    if (!doc) throw Exceptions.notFound("文档不存在");

    const updateData: Record<string, unknown> = {};
    if (dto.fileName !== undefined) updateData.fileName = dto.fileName;

    if (dto.content !== undefined) {
      const chunks = splitTextToChunks(dto.content);
      const fileSize = Buffer.byteLength(dto.content, "utf-8");

      // 删除旧切片
      await this.prisma.knowledgeChunk.deleteMany({ where: { documentId: docId } });

      // 写入新切片
      if (chunks.length > 0) {
        await this.prisma.knowledgeChunk.createMany({
          data: chunks.map((content, index) => ({
            documentId: docId,
            kbId: doc.knowledgeBaseId,
            index,
            content,
            tokenCount: Math.ceil(content.length / 3),
          })),
        });
      }

      updateData.content = dto.content;
      updateData.fileSize = fileSize;
      updateData.chunkCount = chunks.length;

      // 更新知识库切片计数
      await this.prisma.knowledgeBase.update({
        where: { id: doc.knowledgeBaseId },
        data: {
          chunkCount: { increment: chunks.length - doc.chunkCount },
        },
      });
    }

    return this.prisma.knowledgeDocument.update({
      where: { id: docId },
      data: updateData,
    });
  }

  /** 软删除文档 */
  async deleteDocument(docId: number, userId: number) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: docId } });
    if (!doc) throw Exceptions.notFound("文档不存在");

    // 切片没有 status 字段，直接物理删除（文档恢复后需重新解析）
    await this.prisma.knowledgeChunk.deleteMany({ where: { documentId: docId } });

    // 更新知识库计数
    await this.prisma.knowledgeBase.update({
      where: { id: doc.knowledgeBaseId },
      data: {
        documentCount: { decrement: 1 },
        chunkCount: { decrement: doc.chunkCount },
      },
    });

    return this.prisma.knowledgeDocument.update({
      where: { id: docId },
      data: { status: CommonStatus.DELETED },
    });
  }
}
