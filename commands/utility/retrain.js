const { SlashCommandBuilder } = require('discord.js');
const { randomReact, retrainModel, logger } = require('../../functions.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('retrain')
        .setDescription('Retrain the model'),

    async execute(interaction) {
        await interaction.deferReply()
        logger.info(`Retrain command received in channel ${interaction.channel.name} from ${interaction.user.username}`);
        await retrainModel();
        await interaction.editReply('Done!')
    },
}