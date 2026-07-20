-- CreateTable
CREATE TABLE "chat_conversation" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR(255),
    "system_prompt" TEXT,
    "current_message_id" BIGINT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "branch_count" INTEGER NOT NULL DEFAULT 1,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "conversation_id" BIGINT NOT NULL,
    "parent_id" BIGINT,
    "root_id" BIGINT,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT,
    "reasoning_content" TEXT,
    "model" VARCHAR(100),
    "message_type" VARCHAR(50) NOT NULL DEFAULT 'text',
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_summary" (
    "id" BIGSERIAL NOT NULL,
    "conversation_id" BIGINT NOT NULL,
    "branch_message_id" BIGINT NOT NULL,
    "summary" TEXT NOT NULL,
    "start_message_id" BIGINT NOT NULL,
    "end_message_id" BIGINT NOT NULL,
    "token_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_context" (
    "id" BIGSERIAL NOT NULL,
    "conversation_id" BIGINT NOT NULL,
    "message_id" BIGINT NOT NULL,
    "summary_id" BIGINT,
    "context_message_ids" JSONB,
    "raw_messages" JSONB,
    "model" VARCHAR(100) NOT NULL,
    "system_prompt" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "latency" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_context_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_attachment" (
    "id" BIGSERIAL NOT NULL,
    "message_id" BIGINT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(50),
    "file_url" VARCHAR(500) NOT NULL,
    "file_size" BIGINT,
    "mime_type" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message_chunk" (
    "id" BIGSERIAL NOT NULL,
    "message_id" BIGINT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "total_chunks" INTEGER,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_tool_call" (
    "id" BIGSERIAL NOT NULL,
    "message_id" BIGINT NOT NULL,
    "tool_call_id" VARCHAR(100) NOT NULL,
    "tool_name" VARCHAR(100) NOT NULL,
    "arguments" JSONB,
    "result" JSONB,
    "status" SMALLINT NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_tool_call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_agent_run" (
    "id" BIGSERIAL NOT NULL,
    "conversation_id" BIGINT NOT NULL,
    "message_id" BIGINT,
    "parent_agent_run_id" BIGINT,
    "agent_name" VARCHAR(100) NOT NULL,
    "task" VARCHAR(500),
    "input" JSONB,
    "output" JSONB,
    "status" SMALLINT NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_agent_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rag_reference" (
    "id" BIGSERIAL NOT NULL,
    "message_id" BIGINT NOT NULL,
    "document_id" BIGINT NOT NULL,
    "chunk_id" BIGINT,
    "content" TEXT,
    "score" DECIMAL(5,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_rag_reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "document_count" INTEGER NOT NULL DEFAULT 0,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_document" (
    "id" SERIAL NOT NULL,
    "knowledge_base_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "file_name" VARCHAR(500) NOT NULL,
    "file_type" VARCHAR(20) NOT NULL,
    "file_size" BIGINT NOT NULL DEFAULT 0,
    "file_url" VARCHAR(1000),
    "content" TEXT,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunk" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER NOT NULL,
    "kb_id" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_conversation_user_id_last_message_at_idx" ON "chat_conversation"("user_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "chat_conversation_status_idx" ON "chat_conversation"("status");

-- CreateIndex
CREATE INDEX "chat_message_user_id_created_at_idx" ON "chat_message"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_message_conversation_id_parent_id_idx" ON "chat_message"("conversation_id", "parent_id");

-- CreateIndex
CREATE INDEX "chat_message_conversation_id_root_id_idx" ON "chat_message"("conversation_id", "root_id");

-- CreateIndex
CREATE INDEX "chat_message_conversation_id_created_at_idx" ON "chat_message"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_summary_conversation_id_branch_message_id_idx" ON "chat_summary"("conversation_id", "branch_message_id");

-- CreateIndex
CREATE INDEX "chat_context_conversation_id_message_id_idx" ON "chat_context"("conversation_id", "message_id");

-- CreateIndex
CREATE INDEX "chat_context_created_at_idx" ON "chat_context"("created_at");

-- CreateIndex
CREATE INDEX "chat_attachment_message_id_idx" ON "chat_attachment"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_chunk_message_id_chunk_index_key" ON "chat_message_chunk"("message_id", "chunk_index");

-- CreateIndex
CREATE INDEX "chat_tool_call_message_id_idx" ON "chat_tool_call"("message_id");

-- CreateIndex
CREATE INDEX "chat_tool_call_tool_call_id_idx" ON "chat_tool_call"("tool_call_id");

-- CreateIndex
CREATE INDEX "chat_agent_run_conversation_id_idx" ON "chat_agent_run"("conversation_id");

-- CreateIndex
CREATE INDEX "chat_agent_run_parent_agent_run_id_idx" ON "chat_agent_run"("parent_agent_run_id");

-- CreateIndex
CREATE INDEX "chat_agent_run_message_id_idx" ON "chat_agent_run"("message_id");

-- CreateIndex
CREATE INDEX "chat_rag_reference_message_id_idx" ON "chat_rag_reference"("message_id");

-- CreateIndex
CREATE INDEX "chat_rag_reference_document_id_idx" ON "chat_rag_reference"("document_id");

-- CreateIndex
CREATE INDEX "knowledge_base_user_id_updated_at_idx" ON "knowledge_base"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "knowledge_base_status_idx" ON "knowledge_base"("status");

-- CreateIndex
CREATE INDEX "knowledge_document_knowledge_base_id_created_at_idx" ON "knowledge_document"("knowledge_base_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "knowledge_document_user_id_idx" ON "knowledge_document"("user_id");

-- CreateIndex
CREATE INDEX "knowledge_chunk_document_id_idx" ON "knowledge_chunk"("document_id");

-- CreateIndex
CREATE INDEX "knowledge_chunk_kb_id_idx" ON "knowledge_chunk"("kb_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_current_message_id_fkey" FOREIGN KEY ("current_message_id") REFERENCES "chat_message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "chat_message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_root_id_fkey" FOREIGN KEY ("root_id") REFERENCES "chat_message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_summary" ADD CONSTRAINT "chat_summary_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_context" ADD CONSTRAINT "chat_context_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_context" ADD CONSTRAINT "chat_context_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_context" ADD CONSTRAINT "chat_context_summary_id_fkey" FOREIGN KEY ("summary_id") REFERENCES "chat_summary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_attachment" ADD CONSTRAINT "chat_attachment_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_chunk" ADD CONSTRAINT "chat_message_chunk_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_tool_call" ADD CONSTRAINT "chat_tool_call_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_agent_run" ADD CONSTRAINT "chat_agent_run_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_agent_run" ADD CONSTRAINT "chat_agent_run_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_agent_run" ADD CONSTRAINT "chat_agent_run_parent_agent_run_id_fkey" FOREIGN KEY ("parent_agent_run_id") REFERENCES "chat_agent_run"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_rag_reference" ADD CONSTRAINT "chat_rag_reference_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document" ADD CONSTRAINT "knowledge_document_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_base"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document" ADD CONSTRAINT "knowledge_document_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunk" ADD CONSTRAINT "knowledge_chunk_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
