import type { Address, Hex } from "viem";
import type { TabState } from "agenttab-portaldot-sdk";

export type SettleArgs = { id: bigint; cumulative: bigint; signature: Hex };

/** In-process tabs for the 402 dry-run. Nothing here is sent to Portaldot. */
export class MemoryTabs {
  readonly tabs = new Map<string, TabState>();
  readonly settlements: SettleArgs[] = [];
  settleTx: Hex | undefined;

  put(id: bigint, tab: TabState): void {
    this.tabs.set(id.toString(), tab);
  }

  async readTab(id: bigint): Promise<TabState | null> {
    const tab = this.tabs.get(id.toString());
    return tab ? { ...tab } : null;
  }

  async settle(args: SettleArgs): Promise<Hex | undefined> {
    const key = args.id.toString();
    const tab = this.tabs.get(key);
    if (!tab) throw new Error("no tab");
    if (args.cumulative > tab.deposit || args.cumulative <= tab.claimed) throw new Error("settle rejected");
    tab.claimed = args.cumulative;
    this.settlements.push(args);
    return this.settleTx;
  }
}

export type ChainPort = {
  readTab(id: bigint): Promise<TabState | null>;
  settle?(args: SettleArgs): Promise<Hex | undefined>;
};

export function isAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}
