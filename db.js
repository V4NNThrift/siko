require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  dialect: 'mysql',
  logging: false
});

const PlayerUCP = sequelize.define('playerucp', {
  ucp: {
    type: DataTypes.STRING,
    allowNull: false
  },
  verifycode: {
    type: DataTypes.STRING(5),
    allowNull: false
  },
  DiscordID: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true
  },
  salt: {
    type: DataTypes.STRING,
    allowNull: true
  },
  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true,
  createdAt: 'reg_date',
  updatedAt: false,
  tableName: 'playerucp'
});

(async () => {
  try {
    await sequelize.authenticate();
    console.log('[\x1b[34mDB\x1b[0m] ✅ Database berhasil terkoneksi.');
    await sequelize.sync();
  } catch (error) {
    console.error('[\x1b[31mDB ERROR\x1b[0m] ❌ Gagal koneksi ke database:', error.message);
  }
})();

module.exports = { sequelize, PlayerUCP };
