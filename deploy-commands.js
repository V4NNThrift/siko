const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('handleregist')
    .setDescription('Mulai registrasi OTP dan akun'),

  new SlashCommandBuilder()
    .setName('topup')
    .setDescription('topup menu'),

  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('ticket menu'),

  new SlashCommandBuilder()
    .setName('cekucp')
    .setDescription('Melihat daftar karakter dari UCP seorang pemain.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Pemain yang UCP-nya ingin dicek.')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('cekkarakter')
    .setDescription('Menampilkan informasi karakter berdasarkan nama.')
    .addStringOption(option =>
      option.setName('nama_karakter')
        .setDescription('Nama karakter In-Game (Gunakan _ untuk spasi).')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('report-panel')
    .setDescription('Mengirim panel report ke channel ini.'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Melihat latensi bot.'),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Menampilkan informasi tentang seorang user.')
    .addUserOption(option => option.setName('user').setDescription('User yang ingin dilihat informasinya.')),

  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Menampilkan informasi tentang server ini.'),

  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Menampilkan avatar seorang user.')
    .addUserOption(option => option.setName('user').setDescription('User yang avatarnya ingin dilihat.')),

  new SlashCommandBuilder()
    .setName('backupnow')
    .setDescription('Menjalankan proses backup database secara manual.'),

  new SlashCommandBuilder()
    .setName('setschedule')
    .setDescription('Mengatur jadwal auto backup database (Owner only).')
    .addStringOption(option =>
      option.setName('cron_string')
        .setDescription('Format cron string (e.g., "0 */3 * * *")')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Membanned seorang pemain.')
    .addUserOption(option => option.setName('user').setDescription('User Discord yang akan di-ban.').setRequired(true))
    .addIntegerOption(option => option.setName('hari').setDescription('Durasi ban dalam hari (0 untuk permanen).').setRequired(true))
    .addStringOption(option => option.setName('alasan').setDescription('Alasan ban.').setRequired(true)),

  new SlashCommandBuilder()
    .setName('unbanucp')
    .setDescription('Membuka ban seorang pemain berdasarkan nama UCP.')
    .addStringOption(option => option.setName('ucp_name').setDescription('Nama UCP yang akan di-unban.').setRequired(true))
    .addStringOption(option => option.setName('alasan').setDescription('Alasan unban.').setRequired(true))
].map(cmd => cmd.toJSON())

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('[\x1b[33mPROCESS\x1b[0m] Deploying slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('[\x1b[32mDONE\x1b[0m] Slash commands deployed!');
  } catch (err) {
    console.error(err);
  }
})();