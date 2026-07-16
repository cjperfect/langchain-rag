import { BaseMessage } from '@langchain/core/messages';

interface ChatOptions {
    history?: BaseMessage[];
}
declare class AiEngine {
    /**
     * Agent 全局单例
     */
    private static readonly agent;
    /**
     * 普通对话
     */
    chat(input: string, options?: ChatOptions): Promise<string>;
    /**
     * LangChain Stream
     */
    stream(input: string, options?: ChatOptions): AsyncGenerator<string>;
    /**
     * Stream Events
     */
    streamEvents(input: string, options?: ChatOptions): AsyncGenerator<{
        type: "token";
        content: string;
    } | {
        type: "tool_start";
        name?: string;
    } | {
        type: "tool_end";
        name?: string;
    }>;
}

export { AiEngine, type ChatOptions };
