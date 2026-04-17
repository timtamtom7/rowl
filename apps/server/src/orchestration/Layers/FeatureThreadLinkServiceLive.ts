/**
 * FeatureThreadLinkServiceLive — SQLite-based feature-thread linking.
 */
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { ThreadId } from "@t3tools/contracts";

import {
  FeatureThreadLinkService,
  type FeatureThreadLinkServiceShape,
  type FeatureThreadLink,
} from "../Services/FeatureThreadLinkService.ts";

export const FeatureThreadLinkServiceLive = Layer.effect(
  FeatureThreadLinkService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const linkFeatureToThread: FeatureThreadLinkServiceShape["linkFeatureToThread"] = (input) =>
      sql`
        INSERT INTO feature_thread_links (feature_id, thread_id, created_at)
        VALUES (${input.featureId}, ${input.threadId}, ${new Date().toISOString()})
        ON CONFLICT (feature_id, thread_id) DO NOTHING
      `.pipe(Effect.asVoid, Effect.catch(() => Effect.void));

    const unlinkFeatureFromThread: FeatureThreadLinkServiceShape["unlinkFeatureFromThread"] = (
      input,
    ) =>
      sql`
        DELETE FROM feature_thread_links
        WHERE feature_id = ${input.featureId} AND thread_id = ${input.threadId}
      `.pipe(Effect.asVoid, Effect.catch(() => Effect.void));

    const getLinkedThreads: FeatureThreadLinkServiceShape["getLinkedThreads"] = (input) =>
      sql`
        SELECT feature_id AS "featureId", thread_id AS "threadId", created_at AS "createdAt"
        FROM feature_thread_links
        WHERE feature_id = ${input.featureId}
      `.pipe(
        Effect.map((rows) => rows as unknown as FeatureThreadLink[]),
        Effect.catch(() => Effect.succeed([] as ReadonlyArray<FeatureThreadLink>)),
      );

    const getLinkedFeature: FeatureThreadLinkServiceShape["getLinkedFeature"] = (input) =>
      sql`
        SELECT feature_id AS "featureId", thread_id AS "threadId", created_at AS "createdAt"
        FROM feature_thread_links
        WHERE thread_id = ${input.threadId}
        LIMIT 1
      `.pipe(
        Effect.map((rows) => {
          const arr = rows as unknown as FeatureThreadLink[];
          return arr.length > 0 ? arr[0]! : null;
        }),
        Effect.catch(() => Effect.succeed(null as FeatureThreadLink | null)),
      );

    const getLinksForProject: FeatureThreadLinkServiceShape["getLinksForProject"] = (input) =>
      sql`
        SELECT ftl.feature_id AS "featureId", ftl.thread_id AS "threadId", ftl.created_at AS "createdAt"
        FROM feature_thread_links ftl
        INNER JOIN projection_features pf ON ftl.feature_id = pf.feature_id
        WHERE pf.project_id = ${input.projectId}
      `.pipe(
        Effect.map((rows) => rows as unknown as FeatureThreadLink[]),
        Effect.catch(() => Effect.succeed([] as ReadonlyArray<FeatureThreadLink>)),
      );

    return {
      linkFeatureToThread,
      unlinkFeatureFromThread,
      getLinkedThreads,
      getLinkedFeature,
      getLinksForProject,
    } satisfies FeatureThreadLinkServiceShape;
  }),
);
