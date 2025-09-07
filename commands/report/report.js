require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField, ComponentType } = require('discord.js');
const { sequelize, ServerConfig } = require('../../db');

// --- Permission Roles ---
const STAFF_ROLE_IDS = process.env.CEKUCP_ROLE_IDS
  ? process.env.CEKUCP_ROLE_IDS.split(',').map(id => id.trim())
  : [];

// --- Config IDs ---
const PLAYER_LOG_CHANNEL_ID = process.env.PLAYER_REPORT_LOG_CHANNEL_ID || '1414122219403083836';
const STAFF_LOG_CHANNEL_ID = process.env.STAFF_REPORT_LOG_CHANNEL_ID || '1414122248247443557';
const REFUND_TICKET_CATEGORY_ID = process.env.REFUND_TICKET_CATEGORY_ID || '1365274992576565288';
const REFUND_TICKET_SUPPORT_ROLE_ID = process.env.REFUND_TICKET_SUPPORT_ROLE_ID || '1365274991825915982';


module.exports = {
  data: new SlashCommandBuilder()
    .setName('report-panel')
    .setDescription('Mengirim panel report ke channel ini.'),

  async execute(interaction) {
    const hasPermission = interaction.member.roles.cache.some(role => STAFF_ROLE_IDS.includes(role.id));
    if (!hasPermission) {
      return interaction.reply({ content: '❌ Kamu tidak punya izin untuk melakukan perintah ini.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Laporan & Bantuan WINDCITY RP')
      .setDescription(
        'Selamat datang di pusat laporan dan bantuan. Silakan pilih salah satu tombol di bawah ini sesuai dengan kebutuhan Anda.\n\n' +
        '**👤 Report Player**\n' +
        'Gunakan tombol ini jika Anda ingin melaporkan pemain lain yang melanggar peraturan server.\n\n' +
        '**🛡️ Report Staff**\n' +
        'Gunakan tombol ini jika Anda memiliki keluhan atau laporan mengenai kinerja staff.\n\n' +
        '**💸 Refund**\n' +
        'Gunakan tombol ini jika Anda kehilangan item atau aset akibat bug atau masalah server lainnya dan ingin mengajukan permohonan refund.\n\n' +
        '_Penyalahgunaan sistem ini akan dikenakan sanksi._'
      )
      .setFooter({ text: 'WINDCITY RP | Report System' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('report_player').setLabel('Report Player').setStyle(ButtonStyle.Danger).setEmoji('👤'),
        new ButtonBuilder().setCustomId('report_staff').setLabel('Report Staff').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
        new ButtonBuilder().setCustomId('refund_create_ticket').setLabel('Refund').setStyle(ButtonStyle.Success).setEmoji('💸')
      );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Panel report berhasil dikirim.', ephemeral: true });
  },

  async handleInteraction(interaction) {
    const reportSystemIds = /^(report|modal_report|refund)/;
    if (!reportSystemIds.test(interaction.customId)) {
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'refund_create_ticket') {
        await handleRefundTicketCreation(interaction);
      } else if (interaction.customId === 'refund_ticket_open_modal') {
        await interaction.showModal(createRefundModal());
      } else {
        let modal;
        if (interaction.customId === 'report_player') {
          modal = createReportPlayerModal();
        } else if (interaction.customId === 'report_staff') {
          modal = createReportStaffModal();
        }
        if (modal) await interaction.showModal(modal);
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      const user = interaction.user;
      const footerText = `${user.tag} | ${user.id} | ${interaction.customId.replace('modal_', '')}`;
      let logEmbed;

      try {
        if (interaction.customId === 'modal_report_player') {
          logEmbed = processReportPlayer(interaction, footerText);
          const logChannel = await interaction.client.channels.fetch(PLAYER_LOG_CHANNEL_ID).catch(() => null);
          if (logChannel) await logChannel.send({ embeds: [logEmbed] });

        } else if (interaction.customId === 'modal_report_staff') {
          logEmbed = processReportStaff(interaction, footerText);
          const logChannel = await interaction.client.channels.fetch(STAFF_LOG_CHANNEL_ID).catch(() => null);
          if (logChannel) await logChannel.send({ embeds: [logEmbed] });

        } else if (interaction.customId === 'modal_refund') {
          logEmbed = processRefund(interaction, footerText);
          await interaction.channel.send({ embeds: [logEmbed] });

          // Disable the button after submission
          const originalMessage = interaction.message;
          const originalActionRow = originalMessage.components[0];
          const disabledButton = new ButtonBuilder()
            .setCustomId('refund_form_submitted')
            .setLabel('Form Telah Dikirim')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

          const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
          await originalMessage.edit({ components: [disabledRow] });
        }
      } catch (e) {
        return interaction.reply({ content: `❌ Terjadi kesalahan: ${e.message}`, ephemeral: true }).catch(console.error);
      }

      await interaction.reply({ content: 'Laporan telah terkirim. Terima kasih!', ephemeral: true }).catch(console.error);
    }
  },
};

// --- Ticket Creation ---
async function handleRefundTicketCreation(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const t = await sequelize.transaction();
  try {
    let ticketCountConfig = await ServerConfig.findOne({ where: { key: 'refundTicketCount' }, transaction: t });
    if (!ticketCountConfig) {
      ticketCountConfig = await ServerConfig.create({ key: 'refundTicketCount', value: '0' }, { transaction: t });
    }

    const newCount = parseInt(ticketCountConfig.value, 10) + 1;
    await ticketCountConfig.update({ value: newCount.toString() }, { transaction: t });
    await t.commit();

    const channel = await interaction.guild.channels.create({
      name: `tiket-reffund-${newCount}`,
      type: ChannelType.GuildText,
      parent: REFUND_TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: REFUND_TICKET_SUPPORT_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] },
      ],
    });

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle(`💸 Tiket Refund #${newCount}`)
      .setDescription(`Selamat datang, <@${interaction.user.id}>!\n\nStaf kami akan segera membantu Anda. Silakan klik tombol di bawah ini untuk mengisi formulir permohonan refund Anda.`)
      .setFooter({ text: 'Mohon siapkan bukti yang jelas jika diperlukan.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('refund_ticket_open_modal').setLabel('Buka Form Refund').setStyle(ButtonStyle.Primary)
    );

    await channel.send({
      content: `<@&${REFUND_TICKET_SUPPORT_ROLE_ID}>, ada permohonan refund baru.`,
      embeds: [embed],
      components: [row]
    });

    await interaction.editReply({ content: `✅ Tiket Anda telah dibuat: <#${channel.id}>` });

  } catch (error) {
    await t.rollback();
    console.error('Error creating refund ticket:', error);
    await interaction.editReply({ content: '❌ Terjadi kesalahan saat membuat tiket refund. Silakan coba lagi.' });
  }
}

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
  return new ModalBuilder().setCustomId('modal_refund').setTitle('Formulir Permohonan Refund')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('icName').setLabel("Name (IC)").setPlaceholder("Name IC").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tanggalKejadian').setLabel("Tanggal Kejadian").setPlaceholder("Contoh: 26 April 2025").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('itemsRefund').setLabel("Items Reffund").setPlaceholder("Contoh: Kehilangan item X sebanyak 10 buah.").setStyle(TextInputStyle.Paragraph).setMaxLength(750).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kronologi').setLabel("Kronologi").setPlaceholder("Jelaskan secara rinci bagaimana Anda kehilangan item tersebut.").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true))
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
      { name: 'Nama Pelapor (IC)', value: pelaporName }, { name: 'Nama Terlapor', value: terlaporName },
      { name: 'Tanggal Kejadian', value: tanggalKejadian }, { name: 'Kronologi / Kerugian', value: kronologi },
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
        { name: 'Name Pelapor (IC)', value: pelaporName }, { name: 'Name Staff', value: staffName },
        { name: 'Tanggal Kejadian', value: tanggalKejadian }, { name: 'Pelanggaran Terlapor', value: pelanggaran },
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

  return new EmbedBuilder().setColor('#2ECC71').setTitle('💸 Permohonan Refund')
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
