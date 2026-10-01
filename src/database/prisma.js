const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

// Prevent JSON.stringify from throwing on BigInt
if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

prisma.$connect()
  .then(() => {
    logger.info('Database connected successfully via Prisma');
  })
  .catch((err) => {
    logger.error('Failed to connect to database via Prisma:', err.message);
  });

module.exports = prisma;
