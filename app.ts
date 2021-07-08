import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyCors from 'fastify-cors';
import fastifyAuth from 'fastify-auth';
import pino from 'pino';

import UnleashProxy from './proxy'
import Client from './client';

const corsOptions = {
    exposedHeaders: 'ETag',
    maxAge: 604800
};

export interface AppConfig {
    app: FastifyInstance,
    basePath: string;
    unleashUrl: string;
    unleashSecret: string;
    refreshInterval: number;
    metricsInterval: number;
    projectName: string,
    proxySecrets: string[];
}

function resolveProxySecrets(): string[] {
    const secretString = process.env.UNLEASH_PROXY_SECRETS;
    return secretString ? secretString.split(/,\s*/) : [];
}

export function createApp({
    app = fastify(),
    basePath = process.env.BASE_PATH || '',
    unleashUrl = process.env.UNLEASH_URL || '',
    unleashSecret = process.env.UNLEASH_SECRET || '',
    refreshInterval = process.env.UNLEASH_FETCH_INTERVAL ? Number.parseInt(process.env.UNLEASH_FETCH_INTERVAL) : 5*1000,
    metricsInterval = process.env.UNLEASH_METRICS_INTERVAL ? Number.parseInt(process.env.UNLEASH_METRICS_INTERVAL) : 30*1000,
    projectName = process.env.UNLEASH_PROJECT_NAME || 'default',
    proxySecrets = resolveProxySecrets(),
}: Partial<AppConfig>): FastifyInstance {
    const client = new Client({ unleashUrl, unleashSecret, refreshInterval, metricsInterval, projectName })

    return createAppWithClient(app, basePath, client, proxySecrets);
}



function createAppWithClient(app: FastifyInstance, basePath: string, client: Client, proxySecrets: string[]): FastifyInstance {
    if (!Array.isArray(proxySecrets) || proxySecrets.length === 0) {
        throw new Error('You must specify the proxy secrets!');
    }
    const proxy = new UnleashProxy(client, proxySecrets);
    app.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
        const authHeader = request.headers['authorization'];
        if (Array.isArray(authHeader) && authHeader.some(h => proxySecrets.includes(h))) {
            
        } else if (typeof(authHeader) === 'string' && proxySecrets.includes(authHeader)) {
            
        } else {
            reply.status(401).send({ error: 'You must specifiy your proxy secret in the Authorization header'})
        }
    })
    app.register(fastifyCors, corsOptions);
    
    app.register(proxy.getRouter(), { prefix: `${basePath}/proxy`});
    return app;
}