const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { saveDataset, logger } = require('../../functions.js')
let { dataset } = require('../../functions.js')


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
        const usernameToRemove = interaction.options.getUser('user').username
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
            logger.info(`Removed ${removedCount} entries for user "${usernameToRemove}".`)
            await interaction.editReply(`Removed ${removedCount} entries for user "${usernameToRemove}".
-# You'll need to retrain the model if you want them to stop being guessed!`);
        } else {
            await interaction.editReply(`No entries found for user "${usernameToRemove}".`);
        }
    },
}