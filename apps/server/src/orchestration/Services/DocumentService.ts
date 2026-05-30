import type {
  CreateGoalDocumentInput,
  DeleteGoalDocumentInput,
  DeleteGoalDocumentResult,
  GoalDocumentResult,
  ListDocumentsByGoalInput,
  ListDocumentsByGoalResult,
  ReadGoalDocumentInput,
  UpdateGoalDocumentInput,
  WriteGoalDocumentInput,
} from "@t3tools/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { DocumentServiceError } from "../Errors.ts";

export interface DocumentServiceShape {
  readonly createDocument: (
    input: CreateGoalDocumentInput,
  ) => Effect.Effect<GoalDocumentResult, DocumentServiceError>;

  readonly readDocument: (
    input: ReadGoalDocumentInput,
  ) => Effect.Effect<GoalDocumentResult, DocumentServiceError>;

  readonly updateDocument: (
    input: UpdateGoalDocumentInput,
  ) => Effect.Effect<GoalDocumentResult, DocumentServiceError>;

  readonly writeDocument: (
    input: WriteGoalDocumentInput,
  ) => Effect.Effect<GoalDocumentResult, DocumentServiceError>;

  readonly listDocumentsByGoal: (
    input: ListDocumentsByGoalInput,
  ) => Effect.Effect<ListDocumentsByGoalResult, DocumentServiceError>;

  readonly deleteDocument: (
    input: DeleteGoalDocumentInput,
  ) => Effect.Effect<DeleteGoalDocumentResult, DocumentServiceError>;
}

export class DocumentService extends ServiceMap.Service<DocumentService, DocumentServiceShape>()(
  "rowl/orchestration/Services/DocumentService",
) {}
