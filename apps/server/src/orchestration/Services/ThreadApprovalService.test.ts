import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createThreadApprovalService } from "./ThreadApprovalService.ts";

const NOW = "2026-05-30T12:00:00.000Z";

let stateDir: string;
let ids: string[];

beforeEach(async () => {
  stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-thread-approvals-state-"));
  ids = ["gate-1", "gate-2"];
});

afterEach(async () => {
  await fs.rm(stateDir, { recursive: true, force: true });
});

function service() {
  return createThreadApprovalService({
    stateDir,
    generateId: () => ids.shift() ?? "gate-next",
    now: () => NOW,
  });
}

describe("ThreadApprovalService", () => {
  it("creates and lists thread-turn-scoped gates", async () => {
    const approvals = service();

    const created = await Effect.runPromise(
      approvals.createGate({
        threadId: "thread-1",
        turnId: "turn-1",
        type: "file-change",
        description: "Approve README edit",
        proposedChange: {
          files: [{ path: "README.md", status: "modified", diff: "@@ changed" }],
        },
      }),
    );

    expect(created.gate.status).toBe("pending");

    const list = await Effect.runPromise(approvals.listGates({ threadId: "thread-1" }));
    expect(list.gates.map((gate) => gate.id)).toEqual(["gate-1"]);
    expect(list.gates[0]?.proposedChange.files?.[0]?.path).toBe("README.md");
  });

  it("marks approved gates and runs the execution callback", async () => {
    const approvals = service();
    const onApprove = vi.fn();

    const created = await Effect.runPromise(
      approvals.createGate(
        {
          threadId: "thread-1",
          turnId: "turn-1",
          type: "file-change",
          description: "Approve README edit",
          proposedChange: { details: "patch" },
        },
        { onApprove },
      ),
    );

    const approved = await Effect.runPromise(approvals.approveGate({ id: created.gate.id }));

    expect(approved.gate.status).toBe("approved");
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("marks rejected gates and runs the discard callback", async () => {
    const approvals = service();
    const onReject = vi.fn();

    const created = await Effect.runPromise(
      approvals.createGate(
        {
          threadId: "thread-1",
          turnId: "turn-1",
          type: "file-change",
          description: "Approve README edit",
          proposedChange: { details: "patch" },
        },
        { onReject },
      ),
    );

    const rejected = await Effect.runPromise(approvals.rejectGate({ id: created.gate.id }));

    expect(rejected.gate.status).toBe("rejected");
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});
