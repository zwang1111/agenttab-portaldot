/**
 * Live read of AgentTab from a native `5…` account via `ReviveApi_call`,
 * plus the Assets ERC-20 precompile. Reads and dry-runs only: no signature,
 * no `author_submitExtrinsic`.
 *
 *   npm run revive-probe
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeAbiParameters, decodeFunctionResult, type Hex } from "viem";
import {
  ASSETS_ERC20_PREFIX,
  DEMO_PROVIDER,
  POOL_ASSETS_ERC20_PREFIX,
  PORTALDOT_V3_RPC,
  PORTALDOT_V3_SUBSTRATE_RPC,
  agentTabAbi,
  assetsErc20Precompile,
  buildOpenErc20Tab,
} from "agenttab-portaldot-sdk";
import { evmCall, SubstrateRpc } from "./rpc.ts";
import {
  AGENT_TAB,
  DEPLOYER_H160,
  EXISTENTIAL_DEPOSIT_PLANCK,
  TEST_ASSET_ID,
  TEST_ASSET_PRECOMPILE,
  WEI_PER_PLANCK,
  accountIdToH160,
  decodeReviveApiCall,
  deployerFallbackAccountId,
  encodeDecimals,
  encodeErc20String,
  encodeNextId,
  encodeRemaining,
  encodeReviveApiCall,
  encodeReviveCall,
  encodeSettle,
  encodeTabs,
  encodeTotalSupply,
  evmBalanceFromFree,
  type ReviveCallResult,
} from "./revive.ts";
import { ss58Encode } from "./ss58.ts";
import {
  assetMetadataKey,
  assetStorageKey,
  decodeAssetSupply,
  decodeMetadata,
  decodeReviveDust,
  decodeSystemAccount,
  decodeU32,
  foreignIndexKey,
  reviveAccountInfoKey,
  systemAccountKey,
} from "./storage.ts";

const TAB_ID = 1n;

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

async function reviveCall(rpc: SubstrateRpc, dest: `0x${string}`, data: Hex): Promise<ReviveCallResult> {
  const params = encodeReviveApiCall({ origin: deployerFallbackAccountId(), dest, data });
  const raw = await rpc.call<Hex>("state_call", ["ReviveApi_call", `0x${Buffer.from(params).toString("hex")}`]);
  return decodeReviveApiCall(raw);
}

function word(data: Hex): bigint {
  return BigInt(data);
}

async function main(): Promise<void> {
  const outFlag = process.argv.indexOf("--out");
  const outPath =
    outFlag >= 0
      ? process.argv[outFlag + 1]!
      : fileURLToPath(new URL("../../runs/revive-probe.json", import.meta.url));
  const rpc = new SubstrateRpc();
  await rpc.connect();
  try {
    const origin = deployerFallbackAccountId();
    const ss58 = ss58Encode(origin);
    const mapped = await rpc.call<Hex>("state_call", ["ReviveApi_address", `0x${Buffer.from(origin).toString("hex")}`]);
    const accountOfDeployer = await rpc.call<Hex>("state_call", ["ReviveApi_account_id", DEPLOYER_H160]);

    const remainingData = encodeRemaining(TAB_ID);
    const [ethRemaining, subRemaining, ethNext, subNext, ethTabs, subTabs] = await Promise.all([
      evmCall<Hex>("eth_call", [{ to: AGENT_TAB, data: remainingData }, "latest"]),
      reviveCall(rpc, AGENT_TAB, remainingData),
      evmCall<Hex>("eth_call", [{ to: AGENT_TAB, data: encodeNextId() }, "latest"]),
      reviveCall(rpc, AGENT_TAB, encodeNextId()),
      evmCall<Hex>("eth_call", [{ to: AGENT_TAB, data: encodeTabs(TAB_ID) }, "latest"]),
      reviveCall(rpc, AGENT_TAB, encodeTabs(TAB_ID)),
    ]);

    const settleData = encodeSettle(TAB_ID, 6_000_000_000_000_000n, `0x${"11".repeat(65)}` as Hex);
    const settle = await reviveCall(rpc, AGENT_TAB, settleData);

    const open = buildOpenErc20Tab({
      provider: DEMO_PROVIDER,
      assetId: TEST_ASSET_ID,
      amount: 1n,
      expiry: 1_893_456_000n,
    });
    const openDry = await reviveCall(rpc, AGENT_TAB, open.data);

    const precompile = TEST_ASSET_PRECOMPILE;
    const [ethSupply, subSupply, ethName, ethSymbol, ethDecimals] = await Promise.all([
      evmCall<Hex>("eth_call", [{ to: precompile, data: encodeTotalSupply() }, "latest"]),
      reviveCall(rpc, precompile, encodeTotalSupply()),
      evmCall<Hex>("eth_call", [{ to: precompile, data: encodeErc20String("name") }, "latest"]),
      evmCall<Hex>("eth_call", [{ to: precompile, data: encodeErc20String("symbol") }, "latest"]),
      evmCall<Hex>("eth_call", [{ to: precompile, data: encodeDecimals() }, "latest"]),
    ]);

    const [assetRaw, metaRaw, indexRaw, poolRaw, accountRaw, infoRaw, head] = await Promise.all([
      rpc.call<Hex | null>("state_getStorage", [assetStorageKey("Assets", TEST_ASSET_ID)]),
      rpc.call<Hex | null>("state_getStorage", [assetMetadataKey(TEST_ASSET_ID)]),
      rpc.call<Hex | null>("state_getStorage", [foreignIndexKey(TEST_ASSET_ID)]),
      rpc.call<Hex | null>("state_getStorage", [assetStorageKey("PoolAssets", 0)]),
      rpc.call<Hex | null>("state_getStorage", [systemAccountKey(origin)]),
      rpc.call<Hex | null>("state_getStorage", [reviveAccountInfoKey(DEPLOYER_H160)]),
      rpc.call<{ parentHash: string; number: string }>("chain_getHeader", []),
    ]);
    const chain = await rpc.call<string>("system_chain", []);
    const runtime = await rpc.call<{ specName: string; specVersion: number }>("state_getRuntimeVersion", []);

    const foreignIndex = decodeU32(indexRaw);
    const wrongSupply =
      foreignIndex == null
        ? null
        : await evmCall<Hex>("eth_call", [
            { to: assetsErc20Precompile(foreignIndex, ASSETS_ERC20_PREFIX), data: encodeTotalSupply() },
            "latest",
          ]);
    const poolSupplyEth = await evmCall<Hex>("eth_call", [
      { to: assetsErc20Precompile(0, POOL_ASSETS_ERC20_PREFIX), data: encodeTotalSupply() },
      "latest",
    ]);
    const hubStyle = await evmCall<Hex>("eth_getCode", ["0x0000000200000000000000000000000001200000", "latest"]);

    const account = decodeSystemAccount(accountRaw);
    const dust = decodeReviveDust(infoRaw);
    const ethBalance = BigInt(await evmCall<Hex>("eth_getBalance", [DEPLOYER_H160, "latest"]));
    const predicted =
      account && dust != null ? evmBalanceFromFree(account.free, BigInt(dust)) : null;
    const metadata = decodeMetadata(metaRaw);
    const name = decodeFunctionResult({
      abi: [{ type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }],
      functionName: "name",
      data: ethName,
    });
    const symbol = decodeFunctionResult({
      abi: [{ type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }],
      functionName: "symbol",
      data: ethSymbol,
    });

    const tabsEth = decodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "address" },
        { type: "uint128" },
        { type: "uint128" },
        { type: "uint64" },
      ],
      ethTabs,
    );
    const callHex = encodeReviveCall({
      dest: AGENT_TAB,
      weight: subRemaining.weightRequired,
      data: remainingData,
    });

    const assetSupply = decodeAssetSupply(assetRaw);
    const report = {
      submitted: false,
      note: "state_call / eth_call / state_getStorage only. No extrinsic was signed or submitted.",
      probedAt: new Date().toISOString(),
      chain,
      specName: runtime.specName,
      specVersion: runtime.specVersion,
      blockNumber: Number.parseInt(head.number, 16),
      rpc: { evm: PORTALDOT_V3_RPC, substrate: PORTALDOT_V3_SUBSTRATE_RPC },
      origin: {
        ss58,
        accountId: `0x${Buffer.from(origin).toString("hex")}`,
        derivedH160: accountIdToH160(origin),
        reviveApiAddress: mapped,
        addressMatch: mapped.toLowerCase() === accountIdToH160(origin).toLowerCase(),
        reviveApiAccountIdOfDeployer: accountOfDeployer,
        accountIdMatch: accountOfDeployer.toLowerCase() === `0x${Buffer.from(origin).toString("hex")}`,
      },
      agentTab: {
        address: AGENT_TAB,
        tabId: TAB_ID.toString(),
        remaining: {
          ethCall: word(ethRemaining).toString(),
          reviveApi: word(subRemaining.data).toString(),
          match: word(ethRemaining) === word(subRemaining.data) && subRemaining.ok,
        },
        nextId: {
          ethCall: word(ethNext).toString(),
          reviveApi: word(subNext.data).toString(),
          match: word(ethNext) === word(subNext.data) && subNext.ok,
        },
        tabs: {
          payer: tabsEth[0],
          provider: tabsEth[1],
          token: tabsEth[2],
          deposit: tabsEth[3].toString(),
          claimed: tabsEth[4].toString(),
          expiry: tabsEth[5].toString(),
          reviveDataMatch: ethTabs.toLowerCase() === subTabs.data.toLowerCase() && subTabs.ok,
        },
        weightRequired: {
          refTime: subRemaining.weightRequired.refTime.toString(),
          proofSize: subRemaining.weightRequired.proofSize.toString(),
        },
        reviveCallHex: callHex,
        reviveCallHexNote:
          "SCALE of pallet 80 call 1 (Revive.call) for remaining(tab). Unsigned. Not submitted.",
      },
      settleDryRun: {
        submitted: false,
        tabId: TAB_ID.toString(),
        ok: settle.ok,
        reverted: settle.reverted,
        flags: settle.flags,
        gasConsumed: settle.gasConsumed.toString(),
        errorName: settle.errorName ?? null,
        data: settle.data,
        dispatchErrorHex: settle.dispatchErrorHex ?? null,
      },
      balance: {
        freePlanck: account?.free.toString() ?? null,
        reservedPlanck: account?.reserved.toString() ?? null,
        frozenPlanck: account?.frozen.toString() ?? null,
        existentialDepositPlanck: EXISTENTIAL_DEPOSIT_PLANCK.toString(),
        dustWei: dust,
        ethGetBalance: ethBalance.toString(),
        predictedWei: predicted?.toString() ?? null,
        identityHolds: predicted === ethBalance,
        weiPerPlanck: WEI_PER_PLANCK.toString(),
      },
      assetsPrecompile: {
        prefix: "0x0001",
        formula: "bytes[0..4] = assetId big-endian, bytes[16..18] = 0x0001, bytes[18..20] = 0",
        assetId: TEST_ASSET_ID,
        address: precompile,
        storageSupply: assetSupply?.toString() ?? null,
        storageMetadata: metadata,
        ethName: name,
        ethSymbol: symbol,
        ethDecimals: Number(word(ethDecimals)),
        ethTotalSupply: word(ethSupply).toString(),
        reviveTotalSupply: word(subSupply.data).toString(),
        supplyMatch:
          assetSupply != null &&
          assetSupply === word(ethSupply) &&
          word(ethSupply) === word(subSupply.data) &&
          subSupply.ok,
        foreignIndexForAsset: foreignIndex,
        totalSupplyAtForeignIndex:
          wrongSupply == null ? null : word(wrongSupply).toString(),
        foreignIndexIsNotTheAddressId:
          foreignIndex != null && wrongSupply != null && word(wrongSupply) !== word(ethSupply),
        poolAssets: {
          prefix: "0x0002",
          id: 0,
          storageSupply: decodeAssetSupply(poolRaw)?.toString() ?? null,
          ethTotalSupply: word(poolSupplyEth).toString(),
          match: decodeAssetSupply(poolRaw) === word(poolSupplyEth),
        },
        polkadotHubLocalSuffixCode: hubStyle,
      },
      erc20OpenDryRun: {
        submitted: false,
        token: open.token,
        amount: "1",
        ok: openDry.ok,
        reverted: openDry.reverted,
        flags: openDry.flags,
        gasConsumed: openDry.gasConsumed.toString(),
        errorName: openDry.errorName ?? null,
        data: openDry.data,
        note: "Reverted with empty returndata. Not a mined open. The matching totalSupply read is the successful Assets precompile call.",
      },
    };

    const required = [
      report.origin.addressMatch,
      report.origin.accountIdMatch,
      report.agentTab.remaining.match,
      report.agentTab.nextId.match,
      report.agentTab.tabs.reviveDataMatch,
      report.settleDryRun.reverted && report.settleDryRun.errorName === "NotProvider",
      report.balance.identityHolds,
      report.assetsPrecompile.supplyMatch,
      report.assetsPrecompile.foreignIndexIsNotTheAddressId,
      report.assetsPrecompile.poolAssets.match,
      report.erc20OpenDryRun.reverted,
      report.assetsPrecompile.polkadotHubLocalSuffixCode === "0x",
    ];
    if (required.some((ok) => !ok)) {
      console.error(JSON.stringify(report, jsonReplacer, 2));
      throw new Error("live probe did not match the expected Portaldot V3 reads");
    }
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, jsonReplacer, 2)}\n`);
    console.log(`wrote ${outPath}`);
    console.log(
      `remaining ${report.agentTab.remaining.reviveApi} via ReviveApi_call from ${ss58}; settle dry-run ${report.settleDryRun.errorName}; asset ${TEST_ASSET_ID} precompile ${precompile}`,
    );
  } finally {
    rpc.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
