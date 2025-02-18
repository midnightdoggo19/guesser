const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { randomReact, archiveMessages, logger } = require('../../functions.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('archive')
        .setDescription('Save the channel to train the model'),

    async execute(interaction) {
        await interaction.deferReply()
        logger.info(`Archive command received in ${interaction.channel} from ${interaction.user.username}`);
        const count = await archiveMessages(interaction.channel);
        if (interaction.context === 0) {
            await interaction.editReply(`Archived ${count} messages.`);
        } else {
            await interaction.editReply({ content: `Archived ${count} messages.`, flags: 64 });
        }
    },
}
