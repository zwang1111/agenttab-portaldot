import { serve } from "@hono/node-server";
import { pathToFileURL } from "node:url";
import { PORTALDOT_V3_CHAIN_ID } from "agenttab-portaldot-sdk";
import { createGateway } from "./app.js";
import { chainForConfig, configFromEnv, type GatewayConfig } from "./config.js";

export function startServer(config: GatewayConfig = configFromEnv()) {
  const app = createGateway({
    provider: config.provider,
    chain: chainForConfig(config),
    priceWei: config.priceWei,
    agentTab: config.agentTab,
    settleEvery: config.settleEvery,
  });
  return serve({ fetch: app.fetch, port: config.port, hostname: "127.0.0.1" }, (info) => {
    console.log(
      JSON.stringify({
        msg: "agenttab gateway",
        port: info.port,
        mode: config.mode,
        chainId: PORTALDOT_V3_CHAIN_ID,
        agentTab: config.agentTab,
        provider: config.provider,
        priceWei: config.priceWei.toString(),
        settle: config.mode === "rpc" && config.providerKey ? "on" : "off",
      }),
    );
  });
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) startServer();
