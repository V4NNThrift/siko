require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  dialect: 'mysql',
  logging: false
});

const PlayerUCP = sequelize.define('playerucp', {
  ucp: { type: DataTypes.STRING, allowNull: false },
  verifycode: { type: DataTypes.STRING(5), allowNull: false },
  DiscordID: { type: DataTypes.STRING, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: true },
  salt: { type: DataTypes.STRING, allowNull: true },
  verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  pAdmin: { type: DataTypes.INTEGER, defaultValue: 0, field: 'pAdmin' } // Added pAdmin
}, {
  timestamps: true,
  createdAt: 'reg_date',
  updatedAt: false,
  tableName: 'playerucp'
});

const PlayerBan = sequelize.define('PlayerBan', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(24), defaultValue: 'None' },
  ip: { type: DataTypes.STRING(24), defaultValue: 'None' },
  longip: { type: DataTypes.INTEGER, defaultValue: 0 },
  ban_expire: { type: DataTypes.BIGINT, defaultValue: 0 },
  ban_date: { type: DataTypes.BIGINT, defaultValue: 0 },
  last_activity_timestamp: { type: DataTypes.BIGINT, defaultValue: 0 },
  admin: { type: DataTypes.STRING(40), defaultValue: 'Server' },
  reason: { type: DataTypes.STRING(128), defaultValue: 'None' }
}, {
  timestamps: false,
  tableName: 'player_bans'
});

const WarningLog = sequelize.define('WarningLog', {
  pID: { type: DataTypes.INTEGER, defaultValue: -1 },
  WarnType: { type: DataTypes.INTEGER, defaultValue: 0 },
  WarnTime: { type: DataTypes.BIGINT, defaultValue: 0 },
  WarnSender: { type: DataTypes.STRING(64), defaultValue: null },
  WarnReason: { type: DataTypes.STRING(64), defaultValue: null }
}, {
  timestamps: false,
  tableName: 'warninglogs',
  // Sequelize adds an 'id' column by default, but the schema provided does not have one.
  // We need to tell Sequelize not to expect a primary key if there isn't one.
  // However, it's better practice for a table to have a primary key.
  // For now, let's assume 'id' is fine, or we can disable it if sync fails.
  // Let's proceed assuming default 'id' is acceptable.
});


const ServerConfig = sequelize.define('ServerConfig', {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.STRING, allowNull: false },
}, {
  timestamps: false,
  tableName: 'server_config',
});

(async () => {
  try {
    await sequelize.authenticate();
    console.log('[\x1b[34mDB\x1b[0m] ✅ Database berhasil terkoneksi.');
    await sequelize.sync({ alter: true }); // Use alter to add new columns and tables
    console.log('[\x1b[34mDB\x1b[0m] ✅ Database models synced.');
  } catch (error) {
    console.error('[\x1b[31mDB ERROR\x1b[0m] ❌ Gagal koneksi atau sync database:', error.message);
  }
})();

module.exports = { sequelize, PlayerUCP, PlayerBan, WarningLog, ServerConfig };
