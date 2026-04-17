import { ServiceMap } from "effect";

import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

export interface MiniMaxAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {
  readonly provider: "minimax";
}

export class MiniMaxAdapter extends ServiceMap.Service<MiniMaxAdapter, MiniMaxAdapterShape>()(
  "rowl/provider/Services/MiniMaxAdapter",
) {}
