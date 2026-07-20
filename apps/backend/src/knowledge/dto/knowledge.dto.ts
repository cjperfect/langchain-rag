export class CreateKnowledgeBaseDto {
  name!: string;
  description?: string;
}

export class UpdateKnowledgeBaseDto {
  name?: string;
  description?: string;
}

export class CreateDocumentDto {
  fileName!: string;
  content!: string;
}

export class UpdateDocumentDto {
  content?: string;
  fileName?: string;
}
