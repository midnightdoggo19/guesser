const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { saveDataset, logger, dataset } = require('../../functions.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a user from the dataset')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to be removed')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        await interaction.deferReply()
        const usernameToRemove = interaction.options.getString('user')
        logger.info(`Attempting to remove user: "${usernameToRemove}"`);

        const initialCount = dataset.length;

        dataset = dataset.filter(row => {
            if (!row || !row.username || !row.text) {
                console.warn('Skipping malformed row:', row);
                return true;
            }
            return row.username.trim() !== usernameToRemove;
        });

        const removedCount = initialCount - dataset.length;

        if (removedCount > 0) {
            saveDataset(dataset);
            await interaction.editReply(`Removed ${removedCount} entries for user "${usernameToRemove}".`);
        } else {
            await interaction.editReply(`No entries found for user "${usernameToRemove}".`);
        }
    },
}