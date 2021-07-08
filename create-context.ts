import { FastifyRequest } from "fastify";
import P from "pino";

const createContext = (request: FastifyRequest, logger: P.Logger) => {
  const {
    // @ts-ignore
    userId,
    // @ts-ignore
    sessionId,
    // @ts-ignore
    environment,
    // @ts-ignore
    remoteAddress = request.ip,
    // @ts-ignore
    appName,
    // @ts-ignore
    properties,
    // @ts-ignore
    ...rest
  } = request.query;

  const context = {
    appName,
    environment,
    remoteAddress: remoteAddress || request.ip,
    sessionId,
    userId,
    properties: Object.assign({}, rest, properties),
  };
  logger.info(`Context is ${Object.keys(context).join(',')}`);

  // Clean undefined properties
  for (let key in context) {
    // @ts-ignore
    if (context[key] === undefined) {
      // @ts-ignore
      delete context[key];
    }
  }
  logger.info(`Context is ${Object.keys(context).join(',')}`);
  return context;
};

export default createContext;
