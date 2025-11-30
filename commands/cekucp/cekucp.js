require('dotenv').config();
const {
  SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder
} = require('discord.js');
const { sequelize, PlayerUCP } = require('../../db');
const { sendCharacterEmbed } = require('../../utils/character');

// --- Permission Roles ---
const STAFF_ROLE_IDS = process.env.CEKUCP_ROLE_IDS
  ? process.env.CEKUCP_ROLE_IDS.split(',').map(id => id.trim())
  : [];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cekucp')
    .setDescription('Melihat daftar karakter dari UCP seorang pemain.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Pemain yang UCP-nya ingin dicek.')
        .setRequired(true)),

  async execute(interaction) {
    // --- Permission Check ---
    const hasPermission = interaction.member.roles.cache.some(role =>
      STAFF_ROLE_IDS.includes(role.id)
    );
    if (!hasPermission) {
      return interaction.reply({
        content: '❌ Kamu tidak punya izin untuk melakukan perintah ini.',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('user');

    try {
      await interaction.deferReply({ ephemeral: true });

      // First, check if the user has a UCP account at all
      const ucpAccount = await PlayerUCP.findOne({ where: { DiscordID: targetUser.id } });
      if (!ucpAccount) {
        return interaction.editReply(`❌ User <@${targetUser.id}> tidak memiliki akun UCP yang terhubung.`);
      }

      const [characters] = await sequelize.query(`
        SELECT pc.*
        FROM playerucp pu
        JOIN player_characters pc ON pu.ucp = pc.Char_UCP
        WHERE pu.DiscordID = ?
      `, { replacements: [targetUser.id] });

      if (!characters.length) {
        return interaction.editReply(`❌ User <@${targetUser.id}> memiliki akun UCP, namun belum memiliki karakter.`);
      }

      if (characters.length === 1) {
        return sendCharacterEmbed(interaction, characters[0], targetUser);
      }

      // --- Multiple Characters: Show Select Menu ---
      const selectMenuId = `select-ucp-karakter-${targetUser.id}-${interaction.id}`;
      const select = new StringSelectMenuBuilder()
        .setCustomId(selectMenuId)
        .setPlaceholder('Pilih karakter yang ingin ditampilkan')
        .addOptions(characters.map(char => ({
          label: char.Char_Name,
          value: char.Char_Name
        })));

      const row = new ActionRowBuilder().addComponents(select);

      const menuReply = await interaction.editReply({
        content: `User <@${targetUser.id}> memiliki beberapa karakter. Silakan pilih salah satu:`,
        components: [row],
        fetchReply: true
      });

      const collector = menuReply.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id && i.customId === selectMenuId,
        time: 30000, // 30 seconds
        max: 1
      });

      collector.on('collect', async (i) => {
        const selected = characters.find(c => c.Char_Name === i.values[0]);
        if (!selected) {
            return i.update({ content: '❌ Karakter tidak ditemukan.', components: [] });
        }

        await i.update({ content: `✅ Karakter **${selected.Char_Name}** dipilih.`, components: [] });
        await sendCharacterEmbed(i, selected, targetUser, true); // Send as followup
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          interaction.editReply({ content: '⌛ Waktu pemilihan karakter habis.', components: [] });
        }
      });

    } catch (err) {
      console.error('[CEKUCP_CMD_ERROR]', err);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Terjadi kesalahan saat mengambil data karakter.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Terjadi kesalahan saat mengambil data karakter.', ephemeral: true });
      }
    }
  }
};
