-- DropForeignKey
ALTER TABLE "chat_conversation" DROP CONSTRAINT "chat_conversation_knowledge_id_fkey";

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "knowledge_base"("id") ON DELETE CASCADE ON UPDATE CASCADE;
