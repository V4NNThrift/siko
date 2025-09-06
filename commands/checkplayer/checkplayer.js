require('dotenv').config();
const {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  StringSelectMenuBuilder, AttachmentBuilder
} = require('discord.js');
const path = require('path');
const { sequelize, PlayerUCP } = require('../../db');

// --- Permission Roles ---
const STAFF_ROLE_IDS = process.env.CEKUCP_ROLE_IDS
  ? process.env.CEKUCP_ROLE_IDS.split(',').map(id => id.trim())
  : [];

// --- Main Command Definition ---
module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkplayer')
    .setDescription('Mengecek informasi UCP dan karakter seorang pemain.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Pemain yang ingin dicek.')
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

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Pemeriksaan Pemain: ${targetUser.username}`)
      .setDescription(`Silakan pilih tindakan yang ingin Anda lakukan untuk <@${targetUser.id}>.\n\n*Tombol akan kedaluwarsa dalam 1 menit.*`)
      .setFooter({ text: 'Hanya Anda yang dapat melihat pesan ini.' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`checkplayer_karakter_${targetUser.id}`)
          .setLabel('Lihat Karakter')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🧍'),
        new ButtonBuilder()
          .setCustomId(`checkplayer_ucp_${targetUser.id}`)
          .setLabel('Cek UCP')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📄')
      );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  },

  async handleInteraction(interaction) {
    if (!interaction.isButton()) return;
    const [command, action, targetUserId] = interaction.customId.split('_');

    if (command !== 'checkplayer') return;

    // --- Defer Update to acknowledge the button click ---
    await interaction.deferUpdate();

    try {
      if (action === 'ucp') {
        await handleUcpCheck(interaction, targetUserId);
      } else if (action === 'karakter') {
        await handleKarakterCheck(interaction, targetUserId);
      }
    } catch (err) {
      console.error(`[CHECKPLAYER_HANDLER_ERROR]`, err);
      await interaction.followUp({ content: '❌ Terjadi kesalahan saat memproses permintaan Anda.', ephemeral: true });
    }
  }
};

// --- Button Handler: UCP Check ---
async function handleUcpCheck(interaction, targetUserId) {
  const userData = await PlayerUCP.findOne({ where: { DiscordID: targetUserId } });

  if (!userData) {
    return interaction.followUp({ content: '❌ Data UCP untuk user ini tidak ditemukan.', ephemeral: true });
  }

  const targetUser = await interaction.client.users.fetch(targetUserId);
  const formattedDate = `<t:${Math.floor(new Date(userData.reg_date).getTime() / 1000)}:F>`;

  const embed = new EmbedBuilder()
    .setAuthor({ name: 'WINDCITY RP | UCP Checker' })
    .setThumbnail(targetUser.displayAvatarURL())
    .setColor(userData.verified ? '#00B0F4' : '#F4B400')
    .setDescription(
      `📄 **UCP Info untuk <@${targetUserId}>**\n` +
      `> **Username UCP:** \`${userData.ucp}\`\n` +
      `> **Tanggal Daftar:** ${formattedDate}\n`
    )
    .setFooter({ text: 'WINDCITY RP' })
    .setTimestamp();

  await interaction.followUp({ embeds: [embed], ephemeral: true });
}

// --- Button Handler: Karakter Check ---
async function handleKarakterCheck(interaction, targetUserId) {
  const targetUser = await interaction.client.users.fetch(targetUserId);

  const [characters] = await sequelize.query(`
    SELECT pc.*
    FROM playerucp pu
    JOIN player_characters pc ON pu.ucp = pc.Char_UCP
    WHERE pu.DiscordID = ?
  `, { replacements: [targetUserId] });

  if (!characters.length) {
    return interaction.followUp({ content: `❌ User <@${targetUserId}> belum memiliki karakter.`, ephemeral: true });
  }

  if (characters.length === 1) {
    return sendCharacterEmbed(interaction, characters[0], targetUser);
  }

  // --- Multiple Characters: Show Select Menu ---
  const selectMenuId = `select-karakter-${targetUserId}-${interaction.id}`;
  const select = new StringSelectMenuBuilder()
    .setCustomId(selectMenuId)
    .setPlaceholder('Pilih karakter yang ingin ditampilkan')
    .addOptions(characters.map(char => ({
      label: char.Char_Name,
      value: char.Char_Name
    })));

  const row = new ActionRowBuilder().addComponents(select);

  const menuReply = await interaction.followUp({
    content: `User <@${targetUserId}> memiliki beberapa karakter. Silakan pilih salah satu:`,
    components: [row],
    ephemeral: true,
    fetchReply: true
  });

  const collector = menuReply.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id && i.customId === selectMenuId,
    time: 15000,
    max: 1
  });

  collector.on('collect', async (i) => {
    const selected = characters.find(c => c.Char_Name === i.values[0]);
    if (!selected) {
      return i.update({ content: '❌ Karakter tidak ditemukan.', components: [], ephemeral: true });
    }
    // Acknowledge menu selection
    await i.deferUpdate();
    await sendCharacterEmbed(i, selected, targetUser);
  });

  collector.on('end', (collected) => {
    if (collected.size === 0) {
      interaction.editReply({ content: '⌛ Waktu pemilihan karakter habis.', components: [] });
    }
  });
}

// --- Utility: Send Character Embed ---
async function sendCharacterEmbed(interaction, c, user) {
  const body = [
    `Head ${c.Char_Head}%`, `Stomach ${c.Char_Stomach}%`, `LA ${c.Char_LeftArm}%`,
    `RA ${c.Char_RightArm}%`, `LF ${c.Char_LeftFoot}%`, `RF ${c.Char_RightFoot}%`,
  ].join(', ');

  const skinId = c.Char_Skin || 181;
  const filePath = path.resolve(__dirname, `../../skin/${skinId}.png`);
  const attachment = new AttachmentBuilder(filePath, { name: 'karakter.jpg' });

  const embed = new EmbedBuilder()
    .setTitle(`🧍 Karakter: ${c.Char_Name}`)
    .setColor('#FFD700')
    .setAuthor({ name: `Pemilik: ${user.username}`, iconURL: user.displayAvatarURL() })
    .setDescription([
      '**💰 Uang**', `Cash: \`$${c.Char_Money}\``, `Bank: \`$${c.Char_BankMoney}\``, `Rekening: \`${c.Char_BankRek}\``, '',
      '**❤️ Kesehatan**', `Health: \`${c.Char_Health}%\` | Armor: \`${c.Char_Armour}%\``, `Hunger: \`${c.Char_Hunger}%\` | Drink: \`${c.Char_Thirst}%\``,
      `Mental: \`${c.Char_Stress}%\``, `Body: ${body}`, '',
      '**📈 Progress**', `Level: \`${c.Char_Level}\` | Exp: \`${c.Char_LevelUp}\``, `Playtime: \`${convertSecondsToHMS(c.Char_OnlineTimer)}\``, '',
      '**📇 Info Tambahan**', `Skin ID: \`${c.Char_Skin}\``
    ].join('\n'))
    .setImage('attachment://karakter.jpg');

  await interaction.followUp({ embeds: [embed], files: [attachment], ephemeral: true });
}

// --- Utility: Time Converter ---
function convertSecondsToHMS(seconds) {
  seconds = Number(seconds) || 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h} jam ${m} menit ${s} detik`;
}
