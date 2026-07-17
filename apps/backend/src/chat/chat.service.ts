import { Injectable } from "@nestjs/common";
import { ConversationService } from "../conversation/conversation.service";
import { MessageService } from "../message/message.service";
import { AiEngine, type ContextMessage } from "@langchain-rag/ai-engine";
import type { ChatDto, ChatStreamEvent } from "./dto/chat.dto";
import { DEFAULT_MODEL } from "src/common/constants";

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
  ) {}

  /** AI 流式聊天 */
  async *streamChat(userId: number, chatDto: ChatDto): AsyncGenerator<ChatStreamEvent> {
    // 1. 获取会话（前端 initialize 已创建）
    const conversationId = chatDto.chat_session_id;
    if (conversationId == null) {
      throw new Error("缺少 chat_session_id，前端可能未初始化会话");
    }
    const conv = await this.conversationService.get(Number(conversationId));

    // 2. 构建上下文（在当前消息保存前，取历史消息）
    const ctx = await this.messageService.buildContext(
      conversationId,
      Number(conv.currentMessageId),
    );

    // 3. 保存用户消息
    const userMsg = await this.messageService.createUserMessage(userId, conversationId, {
      content: chatDto.prompt,
    });

    // 4. 调用 AI 引擎，流式输出
    const startTime = Date.now();
    let fullContent = "";
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const stream = await this.aiEngine.stream(chatDto.prompt, {
        history: ctx.messages as ContextMessage[],
      });

      for await (const chunk of stream) {
        fullContent += chunk;
        if (!chunk) continue;
        yield { event: "message", data: { content: chunk } };
      }

      inputTokens = Math.ceil(chatDto.prompt.length / 4);
      outputTokens = Math.ceil(fullContent.length / 4);
    } catch (error) {
      yield { event: "error", data: { error: String(error) } };
      return;
    }

    const latency = Date.now() - startTime;

    // 5. 保存 AI 回复
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

    // 6. 保存上下文快照
    await this.messageService.saveContext({
      conversationId,
      messageId: Number(assistantMsg.id),
      summaryId: ctx.summaryId ? Number(ctx.summaryId) : undefined,
      contextMessageIds: ctx.messageIds.map(Number),
      rawMessages: ctx.messages,
      model: ctx.model ?? DEFAULT_MODEL,
      systemPrompt: conv.systemPrompt,
      inputTokens,
      outputTokens,
      latency,
    });

    // 7. 更新会话统计
    await this.conversationService.touch(conversationId, inputTokens + outputTokens);

    // 8. 首次对话自动生成标题
    if (!conv.title) {
      await this.conversationService.update(conversationId, {
        title: chatDto.prompt.slice(0, 50),
      });
    }

    // 9. 更新当前消息位置
    await this.messageService.switchBranch(conversationId, Number(assistantMsg.id));

    // 结束事件：返回本轮问答的消息 ID，前端用于编辑/重新生成等分支操作
    yield {
      event: "done",
      data: {
        request_message_id: Number(userMsg.id),
        response_message_id: Number(assistantMsg.id),
      },
    };
  }
}
