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

-- AddForeignKey
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document" ADD CONSTRAINT "knowledge_document_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_base"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document" ADD CONSTRAINT "knowledge_document_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunk" ADD CONSTRAINT "knowledge_chunk_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
