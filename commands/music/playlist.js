const { globalQueue } = require('../../misc/globals')

const { ServerQueue, check } = require('./ServerQueue');
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder , ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');
const { titleEmbed, fieldEmbed, sendReply, reactToMsg } = require('../../misc/functions')
const { SavedQueues } = require('../../database/models/savedQueues')
const { SlotLimits } = require('../../database/models/slotLimits')

module.exports = {
    name: "playlist",
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Playlist command list')

        .addSubcommand(sub =>
        sub.setName('load')
        .setDescription('Loads a saved queue'))

        .addSubcommand(sub =>
            sub.setName('delete')
            .setDescription('Deletes a playlist'))
        .addSubcommand(sub =>
            sub.setName('save')
            .setDescription('Saves the queue')
            .addStringOption(option =>
                option
                .setName('name')
                .setDescription('Sets the name of the queue')
                .setRequired(true)
            )),

    async execute(interaction, bot) {
        switch (interaction.options.getSubcommand()) {
            default: {
                if (!check(interaction, globalQueue)) return;
                let server_queue = globalQueue.get(interaction.guild.id);
                await server_queue.showQueue(interaction)
                break;
            }
            case 'save':
                {
                    if (!check(interaction, globalQueue)) return;
                    let server_queue = globalQueue.get(interaction.guild.id);
                    //save the queue
                    const name = interaction.options.getString('name')
                        // check limit
                    const limit = await SlotLimits.getLimit(interaction.guild.id)
                        //check how many queues I have already
                    const queueNumber = await SavedQueues.getQueueTotal(interaction.guild.id)
                    if (queueNumber >= limit) return interaction.reply({ embeds: [titleEmbed(interaction.guild, 'Queue limit reached for this server: ' + limit)] })
                    SavedQueues.saveQueue(interaction.guild.id, server_queue.getSongsJson(), name)
                    .then(() => interaction.reply({ embeds: [titleEmbed(interaction.guild, `Queue saved as '${name}'`)] }))
                    .catch(console.error)
                    break;
                }
            case 'load':
                {
                    //check if the user in a voice channel
                    let voice_channel = interaction.member.voice.channel;
                    if (!voice_channel) {
                        interaction.reply({ embeds: [titleEmbed(interaction.guild, ServerQueue.errors.voiceChannelNotFound)], ephemeral: true });
                        return;
                    }
                    let server_queue = globalQueue.get(interaction.guild.id);

                    const row = new ActionRowBuilder();
                    let selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('queues')
                        .setPlaceholder('Seleziona una playist')
                        .setMaxValues(1)
                        .setMinValues(1)


                    let songs = await SavedQueues.getQueues(interaction.guild.id)
                    if (!songs) {
                        return interaction.reply("Non ci sono playlist salvate in questo server")
                    }
                    console.log(songs)
                    for (const song of songs) {
                        selectMenu.addOptions({
                            label: song.queueName,
                            value: song.queueName
                        })
                    }

                    row.addComponents(selectMenu)
                    const row2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                        .setCustomId('load')
                        .setLabel('Load')
                        .setStyle(ButtonStyle.Primary)
                    )
                    let msgmenu = await interaction.reply({ content: '', components: [row, row2], fetchReply: true })
                    const filter = i => {
                        // i.deferUpdate();
                        //the interaction has to come from the user that called the comand
                        return i.user.id === interaction.user.id;
                    };
                    const collector = msgmenu.createMessageComponentCollector({ filter })
                    let selected
                    collector.on('collect', async collected => {
                        console.log("interaction collected")
                        await collected.deferUpdate()
                        if (collected.customId === "load") {
                            collector.stop()
                            return
                        }
                        if (collected.isStringSelectMenu()) {
                            selected = collected.values[0];
                            //update the message with the queue data
                            let songsJson = await SavedQueues.getQueue(collected.guild.id, selected)
                            console.log(songsJson)
                            let remaining, page
                            if(Array.isArray(songsJson)){
                                //array
                                page = songsJson.map((song, counter)=>`${counter+1}. ${song.title}\t${song.durationRaw}`)
                                remaining = page.length - 20
                                if(remaining < 0){
                                    remaining = 0;
                                }
                                // page = []
                                page = page.slice(0,20)
                            }else{
                                page = `${1}. ${songsJson.title}\t${songsJson.durationRaw}`
                                remaining = 0;
                            }
                            page = ServerQueue.queueFormat.start+'\n'+ page +`\n${remaining} more...\n`+ ServerQueue.queueFormat.end;
                            // interaction.followUp({content: page, components: []})
                            await collected.editReply(page)
                        }

                    })

                    collector.on('end', async collected => {
                        const name = selected

                        if (!server_queue) {
                            //create a new server queue
                            let queueJson = await SavedQueues.getQueue(interaction.guild.id, name)
                            console.log(queueJson)
                            server_queue = new ServerQueue(queueJson, interaction.channel, voice_channel)
                            globalQueue.set(interaction.guild.id, server_queue)
                            await server_queue.play()

                        } else {
                            //add songs to existing server queue
                            if (server_queue.voiceChannel !== voice_channel) {
                                interaction.editReply({ embeds: [titleEmbed(interaction.guild, ServerQueue.errors.differentVoiceChannel + `<@${bot.user.id}> !`)], ephemeral: true });
                                return;
                            }
                            //add songs to the existing queue
                            let queueJson = await SavedQueues.getQueue(interaction.guild.id, name)
                            server_queue.addMultiple(queueJson)
                        }
                    })


                    break;
                }
            case 'delete':
                {
                    const row = new ActionRowBuilder()
                    let selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('queues')
                        .setPlaceholder('Seleziona una playist')
                        .setMaxValues(1)
                        .setMinValues(1)


                    let songs = await SavedQueues.getQueues(interaction.guild.id)
                    if (!songs) {
                        return interaction.reply("Non ci sono playlist salvate in questo server")
                    }
                    console.log(songs)
                    for (const song of songs) {
                        selectMenu.addOptions({
                            label: song.queueName,
                            value: song.queueName
                        })
                    }

                    const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder()
                        .setCustomId('delete')
                        .setLabel('Delete')
                        .setStyle(ButtonStyle.Danger))
                    row.addComponents(selectMenu)

                    let msgmenu = await interaction.reply({ components: [row, row2] })

                }
                break;
        }
    },

    async run(msg, args, bot) {

    }
}