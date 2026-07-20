-- AlterTable
ALTER TABLE "chat_conversation" ADD COLUMN     "knowledge_id" INTEGER;

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "knowledge_base"("id") ON DELETE SET NULL ON UPDATE CASCADE;
