import { Schema } from "effect";

import { IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas";
import { ProviderModelOptions } from "./model";
import { ProviderKind } from "./orchestration";

export const CoreAgentId = TrimmedNonEmptyString.check(
  Schema.isMaxLength(128),
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
);
export type CoreAgentId = typeof CoreAgentId.Type;

export const CoreAgentScope = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("global"),
  }),
  Schema.Struct({
    type: Schema.Literal("project"),
    projectRoot: TrimmedNonEmptyString,
  }),
]);
export type CoreAgentScope = typeof CoreAgentScope.Type;

export const CoreAgentPersonality = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("preset"),
    presetId: TrimmedNonEmptyString,
    instructions: TrimmedNonEmptyString,
  }),
  Schema.Struct({
    kind: Schema.Literal("custom"),
    instructions: TrimmedNonEmptyString,
  }),
]);
export type CoreAgentPersonality = typeof CoreAgentPersonality.Type;

export const CoreAgentDefaultModel = Schema.Struct({
  provider: ProviderKind,
  model: TrimmedNonEmptyString,
  modelOptions: Schema.optional(ProviderModelOptions),
});
export type CoreAgentDefaultModel = typeof CoreAgentDefaultModel.Type;

export const CoreAgentMetadata = Schema.Struct({
  id: CoreAgentId,
  name: TrimmedNonEmptyString,
  description: Schema.optional(TrimmedNonEmptyString),
  scope: CoreAgentScope,
  personality: CoreAgentPersonality,
  defaultModel: Schema.optional(CoreAgentDefaultModel),
  tags: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
  pinned: Schema.optional(Schema.Boolean),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type CoreAgentMetadata = typeof CoreAgentMetadata.Type;

export const CoreAgent = CoreAgentMetadata;
export type CoreAgent = CoreAgentMetadata;

export const CoreAgentListRequest = Schema.Struct({
  scope: Schema.optional(CoreAgentScope),
});
export type CoreAgentListRequest = typeof CoreAgentListRequest.Type;

export const CoreAgentListResponse = Schema.Struct({
  agents: Schema.Array(CoreAgent),
  activeAgentId: Schema.NullOr(CoreAgentId),
});
export type CoreAgentListResponse = typeof CoreAgentListResponse.Type;

export const CoreAgentCreateRequest = Schema.Struct({
  name: TrimmedNonEmptyString,
  description: Schema.optional(TrimmedNonEmptyString),
  scope: CoreAgentScope,
  personality: CoreAgentPersonality,
  defaultModel: Schema.optional(CoreAgentDefaultModel),
  tags: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
  pinned: Schema.optional(Schema.Boolean),
});
export type CoreAgentCreateRequest = typeof CoreAgentCreateRequest.Type;

export const CoreAgentUpdateRequest = Schema.Struct({
  agentId: CoreAgentId,
  scope: CoreAgentScope,
  name: Schema.optional(TrimmedNonEmptyString),
  description: Schema.optional(TrimmedNonEmptyString),
  personality: Schema.optional(CoreAgentPersonality),
  defaultModel: Schema.optional(CoreAgentDefaultModel),
  tags: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
  pinned: Schema.optional(Schema.Boolean),
});
export type CoreAgentUpdateRequest = typeof CoreAgentUpdateRequest.Type;

export const CoreAgentDeleteRequest = Schema.Struct({
  agentId: CoreAgentId,
  scope: CoreAgentScope,
});
export type CoreAgentDeleteRequest = typeof CoreAgentDeleteRequest.Type;

export const CoreAgentSetActiveRequest = Schema.Struct({
  agentId: CoreAgentId,
  scope: CoreAgentScope,
});
export type CoreAgentSetActiveRequest = typeof CoreAgentSetActiveRequest.Type;

export const CoreAgentMutationResponse = Schema.Struct({
  agent: CoreAgent,
});
export type CoreAgentMutationResponse = typeof CoreAgentMutationResponse.Type;

export const CoreAgentDeleteResponse = Schema.Struct({});
export type CoreAgentDeleteResponse = typeof CoreAgentDeleteResponse.Type;

export const CoreAgentSetActiveResponse = Schema.Struct({
  activeAgentId: CoreAgentId,
  agent: CoreAgent,
});
export type CoreAgentSetActiveResponse = typeof CoreAgentSetActiveResponse.Type;

export const CoreAgentActiveChangedEvent = Schema.Struct({
  scope: CoreAgentScope,
  activeAgentId: CoreAgentId,
  agent: CoreAgent,
});
export type CoreAgentActiveChangedEvent = typeof CoreAgentActiveChangedEvent.Type;
