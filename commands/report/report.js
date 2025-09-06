require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// --- Permission Roles ---
const STAFF_ROLE_IDS = process.env.CEKUCP_ROLE_IDS
  ? process.env.CEKUCP_ROLE_IDS.split(',').map(id => id.trim())
  : [];

const LOG_CHANNEL_ID = process.env.REPORT_LOG_CHANNEL_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report-panel')
    .setDescription('Mengirim panel report ke channel ini.'),

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

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Laporan Pemain & Staff')
      .setDescription('Silakan gunakan tombol di bawah ini untuk melaporkan pemain, staff, atau untuk mengajukan permohonan refund.\n\n_Penyalahgunaan sistem report ini akan dikenakan sanksi._')
      .setFooter({ text: 'WINDCITY RP | Report System' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('report_player').setLabel('Report Player').setStyle(ButtonStyle.Danger).setEmoji('👤'),
        new ButtonBuilder().setCustomId('report_staff').setLabel('Report Staff').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
        new ButtonBuilder().setCustomId('refund').setLabel('Refund').setStyle(ButtonStyle.Success).setEmoji('💸')
      );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Panel report berhasil dikirim.', ephemeral: true });
  },

  async handleInteraction(interaction) {
    // --- Button Handler: Show Modals ---
    if (interaction.isButton()) {
      let modal;
      if (interaction.customId === 'report_player') {
        modal = createReportPlayerModal();
      } else if (interaction.customId === 'report_staff') {
        modal = createReportStaffModal();
      } else if (interaction.customId === 'refund') {
        modal = createRefundModal();
      }
      if (modal) await interaction.showModal(modal);
      return;
    }

    // --- Modal Submit Handler ---
    if (interaction.isModalSubmit()) {
      if (!LOG_CHANNEL_ID) {
        console.error("REPORT_LOG_CHANNEL_ID is not set in .env file.");
        return interaction.reply({ content: '❌ Konfigurasi channel log belum diatur. Harap hubungi admin.', ephemeral: true });
      }

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (!logChannel) {
        console.error(`Could not find channel with ID ${LOG_CHANNEL_ID}`);
        return interaction.reply({ content: '❌ Gagal menemukan channel log. Harap hubungi admin.', ephemeral: true });
      }

      const user = interaction.user;
      const footerText = `${user.tag} | ${user.id} | ${interaction.customId.replace('modal_', '')}`;

      let logEmbed;

      try {
        if (interaction.customId === 'modal_report_player') {
          logEmbed = processReportPlayer(interaction, footerText);
        } else if (interaction.customId === 'modal_report_staff') {
          logEmbed = processReportStaff(interaction, footerText);
        } else if (interaction.customId === 'modal_refund') {
          logEmbed = processRefund(interaction, footerText);
        }
      } catch(e) {
        return interaction.reply({ content: `❌ Terjadi kesalahan: ${e.message}`, ephemeral: true });
      }

      if (logEmbed) {
        await logChannel.send({ embeds: [logEmbed] });
        await interaction.reply({ content: 'Laporan telah terkirim. Terima kasih!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Gagal memproses laporan, ID modal tidak dikenal.', ephemeral: true });
      }
    }
  },
};

// --- Modal Creation Functions ---
function createReportPlayerModal() {
  return new ModalBuilder().setCustomId('modal_report_player').setTitle('Report Player')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pelaporName').setLabel("Nama Pelapor (IC)").setPlaceholder("Nama IC/Discord Anda").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('terlaporName').setLabel("Nama Terlapor").setPlaceholder("Nama IC/Discord yang dilaporkan").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tanggalKejadian').setLabel("Tanggal Kejadian").setPlaceholder("Contoh: 26 April 2025").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kronologi').setLabel("Kronologi / Kerugian").setPlaceholder("Jelaskan detail kejadian & kerugian").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true))
    );
}

function createReportStaffModal() {
  return new ModalBuilder().setCustomId('modal_report_staff').setTitle('Report Staff')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pelaporName').setLabel("Name Pelapor (IC)").setPlaceholder("Pelapor Name IC").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('staffName').setLabel("Name Staff").setPlaceholder("Nama Staff Ingame (Harus Valid)").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tanggalKejadian').setLabel("Tanggal Kejadian").setPlaceholder("Contoh: 26 April 2025").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pelanggaran').setLabel("Pelanggaran Terlapor").setPlaceholder("Contoh: Admin Glen...").setStyle(TextInputStyle.Paragraph).setMaxLength(750).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kronologi').setLabel("Kronologi Pelapor").setPlaceholder("Contoh: Kemaren aku lewat...").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true))
    );
}

function createRefundModal() {
  return new ModalBuilder().setCustomId('modal_refund').setTitle('Reffund Player')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('icName').setLabel("Name (IC)").setPlaceholder("Name IC").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tanggalKejadian').setLabel("Tanggal Kejadian").setPlaceholder("Contoh: 26 April 2025").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('itemsRefund').setLabel("Items Reffund").setPlaceholder("Contoh: Kehilangan kasih sayang dia 1.").setStyle(TextInputStyle.Paragraph).setMaxLength(750).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kronologi').setLabel("Kronologi").setPlaceholder("Contoh: Jadi aku cinta...").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true))
    );
}

// --- Modal Processing Functions ---
function processReportPlayer(interaction, footerText) {
  const pelaporName = interaction.fields.getTextInputValue('pelaporName');
  const terlaporName = interaction.fields.getTextInputValue('terlaporName');
  const tanggalKejadian = interaction.fields.getTextInputValue('tanggalKejadian');
  const kronologi = interaction.fields.getTextInputValue('kronologi');
  const bukti = extractUrl(kronologi);

  return new EmbedBuilder().setColor('#E67E22').setTitle('👤 Report Player')
    .addFields(
      { name: 'Nama Pelapor (IC)', value: pelaporName },
      { name: 'Nama Terlapor', value: terlaporName },
      { name: 'Tanggal Kejadian', value: tanggalKejadian },
      { name: 'Kronologi / Kerugian', value: kronologi },
    )
    .addFields(bukti ? { name: 'Bukti', value: bukti } : [])
    .setFooter({ text: footerText }).setTimestamp();
}

function processReportStaff(interaction, footerText) {
  const pelaporName = interaction.fields.getTextInputValue('pelaporName');
  const staffName = interaction.fields.getTextInputValue('staffName');
  const tanggalKejadian = interaction.fields.getTextInputValue('tanggalKejadian');
  const pelanggaran = interaction.fields.getTextInputValue('pelanggaran');
  const kronologi = interaction.fields.getTextInputValue('kronologi');
  const bukti = extractUrl(kronologi);

  return new EmbedBuilder().setColor('#95A5A6').setTitle('🛡️ Report Staff')
    .addFields(
        { name: 'Name Pelapor (IC)', value: pelaporName },
        { name: 'Name Staff', value: staffName },
        { name: 'Tanggal Kejadian', value: tanggalKejadian },
        { name: 'Pelanggaran Terlapor', value: pelanggaran },
        { name: 'Kronologi Pelapor', value: kronologi },
    )
    .addFields(bukti ? { name: 'Bukti', value: bukti } : [])
    .setFooter({ text: footerText }).setTimestamp();
}

function processRefund(interaction, footerText) {
  const icName = interaction.fields.getTextInputValue('icName');
  const tanggalKejadian = interaction.fields.getTextInputValue('tanggalKejadian');
  const itemsRefund = interaction.fields.getTextInputValue('itemsRefund');
  const kronologi = interaction.fields.getTextInputValue('kronologi');
  const bukti = extractUrl(kronologi);

  return new EmbedBuilder().setColor('#2ECC71').setTitle('💸 Refund')
    .addFields(
        { name: 'Name (IC)', value: icName },
        { name: 'Tanggal Kejadian', value: tanggalKejadian },
        { name: 'Items Reffund', value: itemsRefund },
        { name: 'Kronologi', value: kronologi },
    )
    .addFields(bukti ? { name: 'Bukti', value: bukti } : [])
    .setFooter({ text: footerText }).setTimestamp();
}

// --- Utility ---
function extractUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    return urls ? urls.join('\n') : null;
}
