import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Exceptions } from "../common/exceptions/business.exception";
import { ErrorCode } from "@langchain-rag/shared";
import type { SendMessageDto, EditMessageDto } from "./dto/message.dto";

@Injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaService) {}

  /** 获取某个分支的完整消息链 */
  async getBranchMessages(conversationId: number, rootId?: number) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw Exceptions.notFound(ErrorCode.CONVERSATION_NOT_FOUND, "会话不存在");

    // 未指定 rootId 时，从 currentMessageId 追溯找到分支根
    let targetRootId = rootId;
    if (!targetRootId && conv.currentMessageId) {
      const head = await this.prisma.chatMessage.findUnique({
        where: { id: conv.currentMessageId },
        select: { rootId: true },
      });
      targetRootId = head?.rootId ? Number(head.rootId) : Number(conv.currentMessageId);
    }

    if (!targetRootId) {
      // 无消息的会话返回空
      return [];
    }

    return this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        OR: [{ rootId: targetRootId }, { id: targetRootId }],
      },
      orderBy: { createdAt: "asc" },
      include: {
        attachments: true,
        toolCalls: true,
      },
    });
  }

  /** 获取某条消息的所有分支子节点 */
  async getBranches(messageId: number) {
    return this.prisma.chatMessage.findMany({
      where: { parentId: messageId },
      select: {
        id: true,
        role: true,
        content: true,
        messageType: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** 创建用户消息 */
  async createUserMessage(
    userId: number,
    conversationId: number,
    dto: SendMessageDto,
  ) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw Exceptions.notFound(ErrorCode.CONVERSATION_NOT_FOUND, "会话不存在");

    // 确定父消息
    const parentId = dto.rootId
      ? await this.findBranchTail(conversationId, dto.rootId)
      : conv.currentMessageId;

    // 确定分支根：有父消息则继承其 root_id，否则（首条消息）以自身为根
    let rootId: bigint | null = null;
    if (parentId) {
      const parent = await this.prisma.chatMessage.findUnique({
        where: { id: parentId },
        select: { rootId: true },
      });
      rootId = parent?.rootId ?? null;
    }

    const msg = await this.prisma.chatMessage.create({
      data: {
        userId,
        conversationId,
        parentId,
        rootId,
        role: "user",
        content: dto.content,
        messageType: dto.messageType ?? "text",
        status: 1,
      },
    });

    // 首条消息或无根消息：以自身为分支根
    if (!rootId) {
      await this.prisma.chatMessage.update({
        where: { id: msg.id },
        data: { rootId: msg.id },
      });
      msg.rootId = msg.id;
    }

    return msg;
  }

  /** 创建 assistant 消息 */
  async createAssistantMessage(
    userId: number,
    conversationId: number,
    parentId: number,
    rootId: number,
    content: string,
    reasoningContent?: string,
    tokenCount?: number,
  ) {
    return this.prisma.chatMessage.create({
      data: {
        userId,
        conversationId,
        parentId,
        rootId,
        role: "assistant",
        content,
        reasoningContent,
        messageType: "text",
        tokenCount: tokenCount ?? 0,
        status: 1,
      },
    });
  }

  /** 编辑消息（分叉：创建新节点） */
  async editMessage(messageId: number, dto: EditMessageDto) {
    const original = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!original) throw Exceptions.notFound(ErrorCode.MESSAGE_NOT_FOUND, "消息不存在");

    return this.prisma.chatMessage.create({
      data: {
        userId: original.userId,
        conversationId: original.conversationId,
        parentId: original.parentId,
        rootId: null, // 分叉即新根
        role: original.role,
        content: dto.content,
        messageType: original.messageType,
        status: 1,
      },
    });
  }

  /** 切换当前分支 */
  async switchBranch(conversationId: number, messageId: number) {
    const msg = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!msg || Number(msg.conversationId) !== conversationId) {
      throw Exceptions.notFound(ErrorCode.MESSAGE_NOT_IN_CONVERSATION, "消息不属于该会话");
    }

    return this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { currentMessageId: messageId },
    });
  }

  // ========================================================================
  // Context 构建
  // ========================================================================

  /** 构建发送给模型的上下文 */
  async buildContext(conversationId: number, userMessageId: number) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw Exceptions.notFound(ErrorCode.CONVERSATION_NOT_FOUND, "会话不存在");

    // 1. 最新摘要
    const summary = await this.prisma.chatSummary.findFirst({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
    });

    // 2. 摘要之后的消息
    const messagesSince = summary
      ? await this.prisma.chatMessage.findMany({
          where: {
            conversationId,
            id: { gt: summary.endMessageId },
            status: 1,
          },
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, reasoningContent: true },
        })
      : await this.prisma.chatMessage.findMany({
          where: {
            conversationId,
            status: 1,
            id: { lte: userMessageId },
          },
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, reasoningContent: true },
        });

    // 3. 拼装 messages 数组
    const messages: Array<{ role: string; content: string }> = [];

    if (conv.systemPrompt) {
      messages.push({ role: "system", content: conv.systemPrompt });
    }

    if (summary) {
      messages.push({ role: "assistant", content: summary.summary });
    }

    for (const m of messagesSince) {
      messages.push({ role: m.role, content: m.content ?? "" });
    }

    return {
      conversationId,
      model: conv.model,
      messages,
      messageIds: messagesSince.map((m) => m.id),
      summaryId: summary?.id,
    };
  }

  /** 保存上下文快照 */
  async saveContext(params: {
    conversationId: number;
    messageId: number;
    summaryId?: number;
    contextMessageIds: number[];
    rawMessages: unknown;
    model: string;
    systemPrompt?: string | null;
    inputTokens: number;
    outputTokens: number;
    latency: number;
  }) {
    return this.prisma.chatContext.create({
      data: params as any,
    });
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  /** 找到分支末端消息 */
  private async findBranchTail(conversationId: number, rootId: number): Promise<number> {
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        OR: [{ rootId }, { id: rootId }],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return messages.length > 0 ? Number(messages[messages.length - 1].id) : rootId;
  }
}
