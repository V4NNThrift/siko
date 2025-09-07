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
    .addUserOption(option => option.setName('user').setDescription('User yang avatarnya ingin dilihat.'))
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