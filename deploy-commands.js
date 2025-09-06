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
    .setName('checkplayer')
    .setDescription('Mengecek informasi UCP dan karakter seorang pemain.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Pemain yang ingin dicek.')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('karakter')
    .setDescription('Menampilkan informasi karakter berdasarkan nama.')
    .addStringOption(option =>
      option.setName('nama_karakter')
        .setDescription('Nama karakter In-Game (Gunakan _ untuk spasi).')
        .setRequired(true))
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