const { globalQueue } = require('../../misc/globals')

const { ServerQueue, check } = require('./serverQueue');
const { SlashCommandBuilder } = require('discord.js');
const { titleEmbed, fieldEmbed, sendReply, reactToMsg } = require('../../misc/functions')

module.exports = {
    name: "shuffle",
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Mixes the queue'),
    async execute() {
        if (!check(interaction, globalQueue)) return;
        let server_queue = globalQueue.get(interaction.guild.id);
        server_queue.shuffle()
        interaction.reply(`${ServerQueue.queueFormat.start}\nShuffled ${server_queue.getSongsLength()} songs\n${ServerQueue.queueFormat.end}`);
    },
    async run(msg, args, bot) {
        if (!check(msg, globalQueue)) return;
        let server_queue = globalQueue.get(msg.guild.id);
        server_queue.shuffle()
        reactToMsg(msg, '🔀');
    }
}