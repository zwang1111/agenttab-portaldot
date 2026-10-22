export const CHAIN_ID: number;
export const RPC_URL: string;
export const EXPLORER_URL: string;
export const AGENT_TAB: string;
export const NATIVE: string;
export const TABS_SELECTOR: string;
export const REMAINING_SELECTOR: string;
export const NEXT_ID_SELECTOR: string;
export const OPENED_TOPIC: string;
export const SETTLED_TOPIC: string;
export const WEI_PER_TPOT: bigint;
export const WEI_PER_PLANCK: bigint;
export const EVM_DECIMALS: number;
export const MAX_LISTED_TABS: number;

export type RecordedTx = {
  label: string;
  hash: string;
  source: string;
  tabId: number | null;
};

export const RECORDED_TXS: readonly RecordedTx[];

export type TabView = {
  payer: string;
  provider: string;
  token: string;
  deposit: bigint;
  claimed: bigint;
  expiry: bigint;
};

export type OpenedLog = {
  id: bigint;
  payer: string;
  provider: string;
  token: string;
  amount: bigint;
  expiry: bigint;
  transactionHash: string;
  blockNumber: bigint;
};

export type SettledLog = {
  id: bigint;
  paid: bigint;
  cumulative: bigint;
  transactionHash: string;
  blockNumber: bigint;
};

export function uint256Word(value: bigint | number | string): string;
export function tabsCalldata(id: bigint | number | string): string;
export function remainingCalldata(id: bigint | number | string): string;
export function parseTabId(raw: string | number | bigint): bigint;
export function formatTpot(wei: bigint, maxFrac?: number): string;
export function isNativeToken(token: string): boolean;
export function decodeUint256(data: string): bigint;
export function decodeTab(data: string): TabView | null;
export function parseOpenedLog(log: { topics: string[]; data: string; transactionHash?: string; blockNumber: string }): OpenedLog;
export function parseSettledLog(log: { topics: string[]; data: string; transactionHash?: string; blockNumber: string }): SettledLog;
export function listedIds(nextId: bigint): bigint[];
export function rpcRequest(url: string, method: string, params: unknown[], fetchImpl?: typeof fetch): Promise<unknown>;
export function isLoopbackUrl(value: string | URL): boolean;
