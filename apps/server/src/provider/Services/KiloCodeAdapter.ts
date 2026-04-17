import { ServiceMap } from "effect";

import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

export interface KiloCodeAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {
  readonly provider: "kilocode";
}

export class KiloCodeAdapter extends ServiceMap.Service<KiloCodeAdapter, KiloCodeAdapterShape>()(
  "rowl/provider/Services/KiloCodeAdapter",
) {}
