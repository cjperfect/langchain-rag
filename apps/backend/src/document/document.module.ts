import { Module } from "@nestjs/common";
import { DocumentService } from "./document.service";
import { DocumentController } from "./document.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";

@Module({
  imports: [PrismaModule, KnowledgeModule],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
