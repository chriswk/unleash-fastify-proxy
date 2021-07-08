import EventEmitter from "events";

import {
  Context,
  getFeatureToggleDefinitions,
  getVariant,
  initialize,
  isEnabled,
  Unleash,
} from "unleash-client";

import pino from "pino";

import Metrics from "unleash-client/lib/metrics";
import P from "pino";

export interface ClientConfig {
  unleashUrl: string;
  unleashSecret: string;
  refreshInterval: number;
  metricsInterval: number;
  environment?: string;
  projectName: string;
}
const appName = "unleash-fastify-proxy";

export default class Client extends EventEmitter {
  private unleashSecret: string;

  private setUnleashSecret(secret: string): void {
    this.unleashSecret = secret;
  }

  private unleashInstance: Unleash;

  private metrics: Metrics;

  private logger: P.Logger;

  constructor({
    unleashUrl,
    unleashSecret,
    refreshInterval = 8000,
    metricsInterval = 30000,
    environment = process.env.UNLEASH_ENVIRONMENT ||
      process.env.NODE_ENV ||
      "development",
    projectName,
  }: ClientConfig) {
    super();
    this.unleashSecret = unleashSecret;
    this.logger = pino();
    const customHeadersFunction = () =>
      Promise.resolve({ Authorization: this.unleashSecret });

    this.unleashInstance = initialize({
      url: unleashUrl,
      appName,
      environment,
      refreshInterval,
      projectName,
      disableMetrics: true,
      customHeadersFunction,
    });

    this.metrics = new Metrics({
      disableMetrics: false,
      appName,
      // @ts-ignore
      instanceId: this.unleashInstance.metrics.instanceId,
      // @ts-ignore
      strategies: this.unleashInstance.metrics.strategies,
      metricsInterval,
      url: unleashUrl,
      customHeadersFunction,
    });
    this.metrics.on("error", (msg) => this.logger.error(`metrics: ${msg}`));
    this.unleashInstance.on("error", (msg) => this.logger.error(msg));
    this.unleashInstance.on("ready", () => this.emit("ready"));
  }

  getEnabledToggles(context: Context | undefined) {
    const definitions = getFeatureToggleDefinitions() || [];
    this.logger.info(`Got ${definitions.length} definitions`);
    return definitions
      .filter((d) => isEnabled(d.name, context))
      .map((d) => ({
        name: d.name,
        enabled: true,
        variant: getVariant(d.name, context),
      }));
  }

  getDefinedToggles(toggleNames: string[], context: Context | undefined) {
    this.logger.info(`Got definitions ${toggleNames.join(',')}`);

    return toggleNames.map((name) => {
      const enabled = isEnabled(name, context);
      this.metrics.count(name, enabled);
      return {
        name,
        enabled,
        variant: getVariant(name, context),
      };
    });
  }

  /*
   * A very simplistic implementation which support counts.
   * In future we must consider to look at start/stop times
   * and adjust counting thereafter.
   */
  registerMetrics(metrics: Metrics): void {
    this.logger.info("Registering metrics");
    // @ts-ignore
    const toggles = metrics.bucket.toggles;

    Object.keys(toggles).forEach((toggleName) => {
      const yesCount = toggles[toggleName].yes;
      const noCount = toggles[toggleName].no;
      [...Array(yesCount)].forEach(() => this.metrics.count(toggleName, true));
      [...Array(noCount)].forEach(() => this.metrics.count(toggleName, false));
    });
  }
}
