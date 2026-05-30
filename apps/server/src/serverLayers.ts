import path from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { CheckpointDiffQueryLive } from "./checkpointing/Layers/CheckpointDiffQuery";
import { CheckpointStoreLive } from "./checkpointing/Layers/CheckpointStore";
import { WorktreeCheckpointServiceLive } from "./checkpointing/Layers/WorktreeCheckpointService";
import { ServerConfig } from "./config";
import { OrchestrationCommandReceiptRepositoryLive } from "./persistence/Layers/OrchestrationCommandReceipts";
import { OrchestrationEventStoreLive } from "./persistence/Layers/OrchestrationEventStore";
import { ProviderSessionRuntimeRepositoryLive } from "./persistence/Layers/ProviderSessionRuntime";
import { OrchestrationEngineLive } from "./orchestration/Layers/OrchestrationEngine";
import { CheckpointReactorLive } from "./orchestration/Layers/CheckpointReactor";
import { OrchestrationReactorLive } from "./orchestration/Layers/OrchestrationReactor";
import { ProviderCommandReactorLive } from "./orchestration/Layers/ProviderCommandReactor";
import { OrchestrationProjectionPipelineLive } from "./orchestration/Layers/ProjectionPipeline";
import { OrchestrationProjectionSnapshotQueryLive } from "./orchestration/Layers/ProjectionSnapshotQuery";
import { ProviderRuntimeIngestionLive } from "./orchestration/Layers/ProviderRuntimeIngestion";
import { RuntimeReceiptBusLive } from "./orchestration/Layers/RuntimeReceiptBus";
import { ProviderUnsupportedError } from "./provider/Errors";
import { makeCopilotAdapterLive } from "./provider/Layers/CopilotAdapter";
import { makeCodexAdapterLive } from "./provider/Layers/CodexAdapter";
import { makeKiloCodeAdapterLive } from "./provider/Layers/KiloCodeAdapter";
import { makeKimiAdapterLive } from "./provider/Layers/KimiAdapter";
import { makeMiniMaxAdapterLive } from "./provider/Layers/MiniMaxAdapter";
import { makeOpenCodeAdapterLive } from "./provider/Layers/OpenCodeAdapter";
import { makePiAdapterLive } from "./provider/Layers/PiAdapter";
import { OpenCodeStateLive } from "./provider/Layers/OpenCodeState";
import { ProviderAdapterRegistryLive } from "./provider/Layers/ProviderAdapterRegistry";
import { makeProviderServiceLive } from "./provider/Layers/ProviderService";
import { ProviderSessionDirectoryLive } from "./provider/Layers/ProviderSessionDirectory";
import { ProviderService } from "./provider/Services/ProviderService";
import { makeEventNdjsonLogger } from "./provider/Layers/EventNdjsonLogger";

import { CodebaseIntelligenceLive } from "./orchestration/Layers/CodebaseIntelligenceLive";
import { ContextBudgetCalculatorLive } from "./orchestration/Layers/ContextBudgetCalculatorLive";
import { ContextServiceLive } from "./orchestration/Layers/ContextServiceLive";
import { ContextTrimmerLive } from "./orchestration/Layers/ContextTrimmerLive";
import { HandoffServiceLive } from "./orchestration/Layers/HandoffServiceLive";
import { EmbeddingServiceLive } from "./orchestration/Layers/EmbeddingServiceLive";
import { MemoryServiceLive } from "./orchestration/Layers/MemoryServiceLive";
import { CoreMemoryLive } from "./memory/Layers/CoreMemoryLive.ts";
import { MultiAgentCoordinatorLive } from "./orchestration/Layers/MultiAgentCoordinatorLive";
import { EvaluatorServiceLive } from "./orchestration/Layers/EvaluatorServiceLive";
import { FeatureThreadLinkServiceLive } from "./orchestration/Layers/FeatureThreadLinkServiceLive";
import { ProjectPromptsServiceLive } from "./orchestration/Layers/ProjectPromptsServiceLive";
import { MemoryEntryRepositoryLive } from "./persistence/Layers/MemoryEntries";
import { OverseerReactorLive } from "./orchestration/Layers/OverseerReactor";
import { FeatureServiceLive } from "./orchestration/Layers/FeatureServiceLive";
import { GoalsServiceLive } from "./orchestration/Layers/GoalsServiceLive";
import { DocumentServiceLive } from "./orchestration/Layers/DocumentServiceLive";
import { ApprovalServiceLive } from "./orchestration/Layers/ApprovalServiceLive";
import { PMChatContextServiceLive } from "./orchestration/Layers/PMChatContextServiceLive";
import { ProjectionContextNodeRepositoryLive } from "./persistence/Layers/ProjectionContextNodes";
import { ProjectionFeatureRepositoryLive } from "./persistence/Layers/ProjectionFeatures";
import { ProjectionGoalRepositoryLive } from "./persistence/Layers/ProjectionGoals";
import { TerminalManagerLive } from "./terminal/Layers/Manager";
import { KeybindingsLive } from "./keybindings";
import { GitManagerLive } from "./git/Layers/GitManager";
import { GitCoreLive } from "./git/Layers/GitCore";
import { WorktreeServiceLive } from "./git/Layers/WorktreeService";
import { GitHubCliLive } from "./git/Layers/GitHubCli";
import { CodexTextGenerationLive } from "./git/Layers/CodexTextGeneration";
import { GitServiceLive } from "./git/Layers/GitService";
import { BunPtyAdapterLive } from "./terminal/Layers/BunPTY";
import { NodePtyAdapterLive } from "./terminal/Layers/NodePTY";
import { AnalyticsService } from "./telemetry/Services/AnalyticsService";

const ENABLE_PROVIDER_EVENT_LOGS_ENV = "ROWL_ENABLE_PROVIDER_EVENT_LOGS";

function shouldEnableProviderEventLogs(): boolean {
  const raw = process.env[ENABLE_PROVIDER_EVENT_LOGS_ENV]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function makeServerProviderLayer(): Layer.Layer<
  ProviderService,
  ProviderUnsupportedError,
  SqlClient.SqlClient | ServerConfig | FileSystem.FileSystem | AnalyticsService
> {
  return Effect.gen(function* () {
    const nativeEventLogger = shouldEnableProviderEventLogs()
      ? yield* Effect.gen(function* () {
          const { stateDir } = yield* ServerConfig;
          const providerLogsDir = path.join(stateDir, "logs", "provider");
          const providerEventLogPath = path.join(providerLogsDir, "events.log");
          return yield* makeEventNdjsonLogger(providerEventLogPath, {
            stream: "native",
          });
        })
      : undefined;
    const canonicalEventLogger = shouldEnableProviderEventLogs()
      ? yield* Effect.gen(function* () {
          const { stateDir } = yield* ServerConfig;
          const providerLogsDir = path.join(stateDir, "logs", "provider");
          const providerEventLogPath = path.join(providerLogsDir, "events.log");
          return yield* makeEventNdjsonLogger(providerEventLogPath, {
            stream: "canonical",
          });
        })
      : undefined;
    const providerSessionDirectoryLayer = ProviderSessionDirectoryLive.pipe(
      Layer.provide(ProviderSessionRuntimeRepositoryLive),
    );
    const codexAdapterLayer = makeCodexAdapterLive(
      nativeEventLogger ? { nativeEventLogger } : undefined,
    );
    const copilotAdapterLayer = makeCopilotAdapterLive();
    const kilocodeAdapterLayer = makeKiloCodeAdapterLive();
    const kimiAdapterLayer = makeKimiAdapterLive();
    const minimaxAdapterLayer = makeMiniMaxAdapterLive();
    const opencodeAdapterLayer = makeOpenCodeAdapterLive();
    const piAdapterLayer = makePiAdapterLive();
    const adapterRegistryLayer = ProviderAdapterRegistryLive.pipe(
      Layer.provide(codexAdapterLayer),
      Layer.provide(copilotAdapterLayer),
      Layer.provide(kilocodeAdapterLayer),
      Layer.provide(kimiAdapterLayer),
      Layer.provide(minimaxAdapterLayer),
      Layer.provide(opencodeAdapterLayer),
      Layer.provide(piAdapterLayer),
      Layer.provideMerge(providerSessionDirectoryLayer),
    );
    return makeProviderServiceLive(
      canonicalEventLogger ? { canonicalEventLogger } : undefined,
    ).pipe(Layer.provide(adapterRegistryLayer), Layer.provide(providerSessionDirectoryLayer));
  }).pipe(Layer.unwrap);
}

export function makeServerRuntimeServicesLayer() {
  const gitCoreLayer = GitCoreLive.pipe(Layer.provideMerge(GitServiceLive));
  const textGenerationLayer = CodexTextGenerationLive;

  const orchestrationLayer = OrchestrationEngineLive.pipe(
    Layer.provide(OrchestrationProjectionPipelineLive),
    Layer.provide(OrchestrationEventStoreLive),
    Layer.provide(OrchestrationCommandReceiptRepositoryLive),
  );

  const checkpointDiffQueryLayer = CheckpointDiffQueryLive.pipe(
    Layer.provideMerge(OrchestrationProjectionSnapshotQueryLive),
    Layer.provideMerge(CheckpointStoreLive),
  );

  const runtimeServicesLayer = Layer.mergeAll(
    orchestrationLayer,
    OrchestrationProjectionSnapshotQueryLive,
    CheckpointStoreLive,
    checkpointDiffQueryLayer,
    RuntimeReceiptBusLive,
  );
  const runtimeIngestionLayer = ProviderRuntimeIngestionLive.pipe(
    Layer.provideMerge(runtimeServicesLayer),
  );

  // Service layers (defined before reactors that depend on them)
  const contextServiceLayer = ContextServiceLive.pipe(
    Layer.provide(ProjectionContextNodeRepositoryLive),
  );
  const featureServiceLayer = FeatureServiceLive.pipe(
    Layer.provide(ProjectionFeatureRepositoryLive),
  );
  const goalsServiceLayer = GoalsServiceLive.pipe(Layer.provide(ProjectionGoalRepositoryLive));
  const documentServiceLayer = DocumentServiceLive;
  const approvalServiceLayer = ApprovalServiceLive;
  const pmChatContextServiceLayer = PMChatContextServiceLive.pipe(
    Layer.provide(orchestrationLayer),
    Layer.provide(goalsServiceLayer),
    Layer.provide(featureServiceLayer),
    Layer.provide(contextServiceLayer),
  );
  const contextBudgetCalculatorLayer = ContextBudgetCalculatorLive.pipe(
    Layer.provide(orchestrationLayer),
    Layer.provide(goalsServiceLayer),
    Layer.provide(featureServiceLayer),
  );
  const memoryServiceLayer = MemoryServiceLive.pipe(
    Layer.provide(MemoryEntryRepositoryLive),
    Layer.provide(EmbeddingServiceLive),
  );
  const coreMemoryLayer = Effect.gen(function* () {
    const { stateDir } = yield* ServerConfig;
    return CoreMemoryLive({ stateDir });
  }).pipe(Layer.unwrap);
  const multiAgentCoordinatorLayer = MultiAgentCoordinatorLive.pipe(
    Layer.provide(orchestrationLayer),
  );

  const handoffServiceLayer = HandoffServiceLive.pipe(
    Layer.provide(orchestrationLayer),
    Layer.provide(goalsServiceLayer),
    Layer.provide(featureServiceLayer),
    Layer.provide(memoryServiceLayer),
  );

  const providerCommandReactorLayer = ProviderCommandReactorLive.pipe(
    Layer.provideMerge(runtimeServicesLayer),
    Layer.provideMerge(gitCoreLayer),
    Layer.provideMerge(textGenerationLayer),
    Layer.provideMerge(goalsServiceLayer),
    Layer.provideMerge(featureServiceLayer),
    Layer.provideMerge(ContextTrimmerLive),
    Layer.provideMerge(memoryServiceLayer),
    Layer.provideMerge(ProjectPromptsServiceLive),
  );
  const checkpointReactorLayer = CheckpointReactorLive.pipe(
    Layer.provideMerge(runtimeServicesLayer),
  );
  const evaluatorServiceLayer = EvaluatorServiceLive.pipe(Layer.provide(orchestrationLayer));
  const overseerReactorLayer = OverseerReactorLive.pipe(
    Layer.provideMerge(runtimeServicesLayer),
    Layer.provideMerge(contextServiceLayer),
    Layer.provideMerge(memoryServiceLayer),
    Layer.provideMerge(CodebaseIntelligenceLive),
    Layer.provideMerge(handoffServiceLayer),
    Layer.provideMerge(evaluatorServiceLayer),
  );
  const orchestrationReactorLayer = OrchestrationReactorLive.pipe(
    Layer.provideMerge(runtimeIngestionLayer),
    Layer.provideMerge(providerCommandReactorLayer),
    Layer.provideMerge(checkpointReactorLayer),
    Layer.provideMerge(overseerReactorLayer),
  );

  const terminalLayer = TerminalManagerLive.pipe(
    Layer.provide(
      typeof Bun !== "undefined" && process.platform !== "win32"
        ? BunPtyAdapterLive
        : NodePtyAdapterLive,
    ),
  );

  const gitManagerLayer = GitManagerLive.pipe(
    Layer.provideMerge(gitCoreLayer),
    Layer.provideMerge(GitHubCliLive),
    Layer.provideMerge(textGenerationLayer),
  );
  const worktreeServiceLayer = WorktreeServiceLive.pipe(Layer.provideMerge(GitServiceLive));
  const worktreeCheckpointServiceLayer = WorktreeCheckpointServiceLive.pipe(
    Layer.provideMerge(worktreeServiceLayer),
    Layer.provideMerge(CheckpointStoreLive),
    Layer.provideMerge(GitServiceLive),
  );

  return Layer.mergeAll(
    orchestrationReactorLayer,
    gitManagerLayer,
    terminalLayer,
    OpenCodeStateLive,
    KeybindingsLive,
    contextServiceLayer,
    CodebaseIntelligenceLive,
    contextBudgetCalculatorLayer,
    featureServiceLayer,
    goalsServiceLayer,
    documentServiceLayer,
    approvalServiceLayer,
    FeatureThreadLinkServiceLive,
    handoffServiceLayer,
    memoryServiceLayer,
    multiAgentCoordinatorLayer,
    ProjectPromptsServiceLive,
    pmChatContextServiceLayer,
    worktreeServiceLayer,
    worktreeCheckpointServiceLayer,
  ).pipe(
    // Provide shared ambient services *after* the mergeAll so peer layers that
    // transitively require them can resolve them. Putting them inside the
    // mergeAll made Effect build layers in parallel, so peer layers could not
    // see them. Covers GitCore and ContextTrimmer, both previously provided
    // only deeper in the orchestration reactor chain.
    Layer.provideMerge(gitCoreLayer),
    Layer.provideMerge(ContextTrimmerLive),
    Layer.provideMerge(coreMemoryLayer),
    Layer.provideMerge(NodeServices.layer),
  );
}
