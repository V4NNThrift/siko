require('dotenv').config();
const { SlashCommandBuilder } = require('discord.js');
const { sequelize } = require('../../db');
const { sendCharacterEmbed } = require('../../utils/character');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cekkarakter')
    .setDescription('Menampilkan informasi karakter berdasarkan nama.')
    .addStringOption(option =>
      option.setName('nama_karakter')
        .setDescription('Nama karakter In-Game (Gunakan _ untuk spasi).')
        .setRequired(true)),

  async execute(interaction) {
    const characterName = interaction.options.getString('nama_karakter');

    try {
      await interaction.deferReply();

      const query = `
        SELECT pc.*, pu.DiscordID
        FROM player_characters pc
        LEFT JOIN playerucp pu ON pc.Char_UCP = pu.ucp
        WHERE pc.Char_Name = ?
      `;
      const [results] = await sequelize.query(query, { replacements: [characterName] });

      if (results.length === 0) {
        return interaction.editReply(`❌ Karakter dengan nama **${characterName}** tidak ditemukan.`);
      }

      const characterData = results[0];
      let targetUser = null;

      if (characterData.DiscordID) {
        try {
          targetUser = await interaction.client.users.fetch(characterData.DiscordID);
        } catch (err) {
          console.log(`[CEKKARAKTER_FETCH_USER_WARN] Could not fetch user ${characterData.DiscordID} for character ${characterName}. They might not be in the server.`);
        }
      }

      // If user is not in the server, create a mock user object for display
      if (!targetUser) {
        targetUser = {
          username: 'Tidak Diketahui',
          displayAvatarURL: () => interaction.client.user.displayAvatarURL() // Default avatar
        };
      }

      await sendCharacterEmbed(interaction, characterData, targetUser);

    } catch (err) {
      console.error('[CEKKARAKTER_CMD_ERROR]', err);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Terjadi kesalahan saat mengambil data karakter.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Terjadi kesalahan saat mengambil data karakter.', ephemeral: true });
      }
    }
  }
};
