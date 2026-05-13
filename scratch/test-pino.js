const pino = require('pino');
const logger = pino();

const err = new Error('Something went wrong');
logger.error({ error: err }, 'Log with error object');
logger.error(err, 'Log with error as first arg');
