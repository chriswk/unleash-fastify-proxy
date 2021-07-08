import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import pino from "pino";
import P from "pino";
import Client from "./client";

import createContext from "./create-context";

const NOT_READY = 'Unleash Proxy has not connected to unleash-api and is not ready to accept requests yet.';

export default class UnleashProxy {
    private ready: boolean;

    private client: Client;

    private proxySecrets: string[];

    private unleashSecret: string;

    private logger: P.Logger;

    constructor(client: Client, proxySecrets: string[]) {
        this.ready = false;
        this.client = client;
        this.unleashSecret = ''
        this.proxySecrets = proxySecrets;
        this.logger = pino();
        this.client.on('ready', () => {
            this.ready = true;
            this.logger.info('Client is ready');
        });
       
    }

    getRouter(): FastifyPluginAsync {
        return async (fastify) => {
            fastify.get('/health', this.health.bind(this));
            fastify.get('/', this.getEnabledToggles.bind(this));
            fastify.post('/', this.lookupToggles.bind(this));
            fastify.post('/client/metrics', this.registerMetrics.bind(this));
        }
    }

    setProxySecrets(secrets: string[]): void {
        this.proxySecrets = secrets;
    }

    setUnleashSecret(secret: string): void {
        this.unleashSecret = secret;
    }

    async health(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        if (!this.ready) {
            reply.status(503).send(NOT_READY);
        }
        reply.status(200).send('ok');
    }

    async getEnabledToggles(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        if (!this.ready) {
            reply.status(503).send(NOT_READY);
        } else {
            const context = createContext(request, this.logger);
            const toggles = this.client.getEnabledToggles(context);
            reply.header('Cache-control', 'public, max-age=2');
            reply.send({ toggles });
        }
    }

    async lookupToggles(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        if (!this.ready) {
            reply.status(503).send(NOT_READY);
        } else {
            // @ts-ignore
            const toggleNames = request.body.toggles;
            // @ts-ignore
            const context = request.body.context;

            const toggles = this.client.getDefinedToggles(toggleNames, context);
            reply.send(toggles);
        }
    }

    async registerMetrics(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const data: any = request.body;

        this.client.registerMetrics(data);
        reply.status(200).send()
    }
}