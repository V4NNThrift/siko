const pino = require('pino');
const logger = pino({
  level: 'silent'
});
module.exports = logger;