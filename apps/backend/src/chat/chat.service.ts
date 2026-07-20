import { Injectable } from "@nestjs/common";
import { ConversationService } from "../conversation/conversation.service";
import { MessageService } from "../message/message.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiEngine, ragService } from "@langchain-rag/ai-engine";
import type { RagSearchResult } from "@langchain-rag/ai-engine";
import { BusinessException } from "../common/exceptions/business.exception";
import { ErrorCode } from "@langchain-rag/shared";
import type { ChatDto, ChatStreamEvent } from "./dto/chat.dto";
import { DEFAULT_MODEL } from "src/common/constants";
import { ContextMessage } from "@langchain-rag/shared/interfaces";

/**
 * AI Chat 服务 — 组合操作
 *
 * 一次 POST /api/chat = 创建/复用会话 + 保存用户消息 + 调用模型 SSE 流式 + 保存回复
 */
@Injectable()
export class ChatService {
  private readonly aiEngine = new AiEngine();

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly prisma: PrismaService,
  ) {}

  async *streamChat(userId: number, chatDto: ChatDto): AsyncGenerator<ChatStreamEvent> {
    // 1. 获取会话（前端 initialize 已创建）
    const conversationId = chatDto.chat_session_id;
    if (conversationId == null) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, "未初始化会话");
    }

    const conv = await this.conversationService.get(conversationId);
    // 会话id传给前端，后续对话带过来
    yield { event: "session", data: { session_id: conversationId } };

    // 确定父消息 ID（前端传了 parent_message_id 则用它，否则用 currentMessageId）
    const parentMessageId = chatDto.parent_message_id
      ? chatDto.parent_message_id
      : Number(conv.currentMessageId);

    // 3. 构建上下文（取父消息之前的历史）
    const ctx = await this.messageService.buildContext(conversationId, parentMessageId);

    // 4. 保存用户消息
    const userMsg = await this.messageService.createUserMessage(userId, conversationId, {
      content: chatDto.prompt,
      rootId: chatDto.parent_message_id,
    });

    // 5. RAG 检索 + 组装上下文（kbIds 合并 knowledge_ids 和 knowledge_id 两个来源）
    const kbIds = chatDto.knowledge_ids?.length
      ? chatDto.knowledge_ids
      : chatDto.knowledge_id != null
        ? [chatDto.knowledge_id]
        : [];
    const { enhancedPrompt, retrievedDocs } = await this.buildRagContext(
      chatDto.prompt,
      kbIds,
    );

    // 从数据库查询知识库名称（向量 metadata 可能没有，旧数据兼容）
    const uniqueKbIds = [...new Set(retrievedDocs.map((d) => d.kbId))];
    const kbs = uniqueKbIds.length > 0
      ? await this.prisma.knowledgeBase.findMany({
          where: { id: { in: uniqueKbIds } },
          select: { id: true, name: true },
        })
      : [];
    const idToName = new Map(kbs.map((k) => [k.id, k.name]));

    // 向客户端通知 RAG 检索结果（知识来源名称 + 结果数）
    if (retrievedDocs.length > 0) {
      yield {
        event: "knowledge_search",
        data: {
          query: chatDto.prompt,
          kbIds,
          results: `共检索到 ${retrievedDocs.length} 条相关文档片段`,
          kbNames: uniqueKbIds.map((id) => idToName.get(id) ?? `知识库#${id}`),
        },
      };
    }

    // 6. 调用 AI 引擎，流式输出（模型每消息可选切换）
    const startTime = Date.now();
    let fullContent = "";
    let fullReasoning = "";
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const stream = this.aiEngine.streamEvents(enhancedPrompt, {
        history: ctx.messages as ContextMessage[],
        model: chatDto.model,
      });

      for await (const event of stream) {
        switch (event.type) {
          case "reasoning":
            fullReasoning += event.content;
            yield { event: "reasoning", data: { content: event.content } };
            break;
          case "tool_start":
            yield { event: "tool_start", data: { toolName: event.name } };
            break;
          case "tool_end":
            yield {
              event: "tool_end",
              data: { toolName: event.name, result: event.result },
            };
            break;
          case "knowledge_search":
            // 只转发 agent 自己的 knowledge_search（pre-search 已在前面发过）
            if (event.query === "") {
              yield {
                event: "knowledge_search",
                data: { query: event.query, kbIds: event.kbIds, kbNames: event.kbNames, results: event.results },
              };
            }
            break;
          case "token":
            fullContent += event.content;
            yield { event: "message", data: { content: event.content } };
            break;
        }
      }

      inputTokens = Math.ceil(enhancedPrompt.length / 4);
      outputTokens = Math.ceil((fullContent + fullReasoning).length / 4);
    } catch (error) {
      yield { event: "error", data: { error: String(error) } };
      return;
    }

    const latency = Date.now() - startTime;

    // 7. 保存 AI 回复
    const rootId = Number(userMsg.rootId ?? userMsg.id);
    const assistantMsg = await this.messageService.createAssistantMessage(
      userId,
      conversationId,
      Number(userMsg.id),
      rootId,
      fullContent,
      undefined,
      outputTokens,
    );

    // 8. 保存 RAG 检索引用
    if (retrievedDocs.length > 0) {
      await this.messageService
        .saveRagReferences(Number(assistantMsg.id), retrievedDocs)
        .catch((err) => console.error("[Chat] 保存 RAG 引用失败:", err));
    }

    // 9. 保存上下文快照
    await this.messageService.saveContext({
      conversationId,
      messageId: Number(assistantMsg.id),
      summaryId: ctx.summaryId ? Number(ctx.summaryId) : undefined,
      contextMessageIds: ctx.messageIds.map(Number),
      rawMessages: ctx.messages,
      model: chatDto.model ?? DEFAULT_MODEL,
      systemPrompt: conv.systemPrompt,
      inputTokens,
      outputTokens,
      latency,
    });

    // 10. 更新会话统计
    await this.conversationService.touch(conversationId, inputTokens + outputTokens);

    // 11. 首次对话自动生成标题
    if (!conv.title) {
      await this.conversationService.update(conversationId, {
        title: chatDto.prompt.slice(0, 50),
      });
    }

    // 9. 更新当前消息位置
    await this.messageService.switchBranch(conversationId, Number(assistantMsg.id));

    // 结束事件：返回本轮问答的消息 ID + RAG 来源，前端用于编辑/重新生成 + 展示知识来源
    yield {
      event: "done",
      data: {
        request_message_id: Number(userMsg.id),
        response_message_id: Number(assistantMsg.id),
        rag_sources: retrievedDocs.map((d) => ({
          kbId: d.kbId,
          kbName: idToName.get(d.kbId) ?? d.kbName ?? `知识库#${d.kbId}`,
          documentId: d.documentId,
          documentName: d.documentName ?? `文档#${d.documentId}`,
          score: d.score,
        })),
      },
    };
  }

  /** RAG 检索 + 组装上下文 */
  private async buildRagContext(
    prompt: string,
    kbIds?: number[],
  ): Promise<{ enhancedPrompt: string; retrievedDocs: RagSearchResult[] }> {
    if (!kbIds?.length) return { enhancedPrompt: prompt, retrievedDocs: [] };

    const retrievedDocs = await ragService.search(prompt, { kbIds, k: 5 }).catch((err) => {
      console.error("[Chat] RAG 检索失败:", err);
      return [];
    });

    if (retrievedDocs.length === 0) return { enhancedPrompt: prompt, retrievedDocs: [] };

    const ragContext = retrievedDocs
      .map(
        (d, i) =>
          `<document index="${i + 1}" source="${d.kbName ?? `知识库#${d.kbId}`}/${d.documentName ?? `文档#${d.documentId}`}" score="${d.score.toFixed(4)}">\n${d.content}\n</document>`,
      )
      .join("\n\n");

    return {
      enhancedPrompt: `${prompt}\n\n<documents>\n${ragContext}\n</documents>`,
      retrievedDocs,
    };
  }
}
