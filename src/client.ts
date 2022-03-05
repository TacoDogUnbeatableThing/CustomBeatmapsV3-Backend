import { Client, Intents, Message, MessageActionRow, MessageButton, MessageEmbed, TextChannel } from 'discord.js'
import { readFileSync } from "fs";

import { IBeatmapSubmission } from './data'

interface IRunClientArgs {
    onAcceptBeatmap : (beatmapURL : string, onComplete : () => void) => void;
    onPostSubmission : (submission : IBeatmapSubmission) => void;
    onRejectSubmission : (downloadURL : string) => void;
}
export const runClient = ({onAcceptBeatmap, onPostSubmission, onRejectSubmission} : IRunClientArgs) => {

    const client = new Client({
        intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS]
    })

    const config = JSON.parse(readFileSync('config.json', 'utf8'))    

    const isUserSubmission = (message : Message<boolean>) : boolean =>  {
        const attachmentName = message.attachments.at(0)?.attachment.toString()
        return message.channelId === config["user-beatmap-submission-channel-id"]
                && !!attachmentName
                && attachmentName.toLowerCase().endsWith(".zip");
    }
    
    // The bot sent this and it is a poll that we have NOT answered yet
    const isBotSentUnansweredVerifierPoll = (message : Message<boolean>) : boolean => {
        if (message.channelId === config["mod-beatmap-verify-channel-id"] && client.user?.id === message.author.id) {
            // A poll is open if there are 2 buttons
            const comp = message.components[0]
            return comp.components.length == 2;
        }
        return false;
    }
    
    const getBeatmapDownloadURLFromVerifierPoll = (message : Message<boolean>) : string | null => {
        const embed = message.embeds[0]
        if (!!embed) {
            return embed.url
        }
        return null
    }
    
    const getDefaultMessageButtons = () : MessageButton[] => {
        return [
            new MessageButton()
                .setCustomId('accept')
                .setLabel(`✅ Accept`)
                .setStyle('PRIMARY'),
            new MessageButton()
                .setCustomId('reject')
                .setLabel(`❌ Reject`)
                .setStyle('DANGER')
        ];
    }
    
    const receiveUserSubmission = (message : Message<boolean>) => {
        // Indicate we've received their submission
        message.react(config["processing-reaction"])
        // Post a simple poll to the "verification" area
        const channel = client.channels.cache.get(config["mod-beatmap-verify-channel-id"]) as TextChannel
        const pollPrompt = `${config["approve-reaction"]} to accept and upload, ${config["reject-reaction"]} to reject (DM creator with reason)`
    
        const attachmentURL = message.attachments.at(0)?.attachment.toString();
        const attachmentURLParts = !!attachmentURL? attachmentURL.split('/') : []
        const attachmentName = attachmentURLParts.length != 0? attachmentURLParts[attachmentURLParts.length - 1] : "(error: none)"
        const avatarURL = message.author.avatarURL()
        const embed = new MessageEmbed()
                .setColor('#0099FF')
                .setTitle(attachmentName)
                .setThumbnail(!!avatarURL? avatarURL : "")
                .setURL(!!attachmentURL? attachmentURL : message.url)
                .setAuthor(message.author.username)
                .setDescription(`${message.author.toString()}: ${message.content}\n${message.url}`);
    
        const buttons = new MessageActionRow()
                .addComponents(
                    getDefaultMessageButtons()
                )
        if (!!attachmentURL) {
            onPostSubmission({
                username: message.author.username,
                avatarURL: !!avatarURL? avatarURL : "",
                downloadURL: attachmentURL
            })
        }
    
        channel.send({ embeds: [embed], components: [buttons] });
    }
    
    client.on("messageCreate", message => {
        if (message.author.bot) return
        if (isUserSubmission(message)) {
            receiveUserSubmission(message)
        }
    });
    
    // Append a log message to a message that has 1 normal embed and 1 logging embed
    const appendVerifierLog = (log : string, message : Message<boolean>, buttons: MessageButton[]) => {
    
        let embeds = message.embeds
        if (embeds.length == 1) {
            embeds.push(new MessageEmbed().setDescription(log))
        } else if (embeds.length == 2) {
            embeds[1] = embeds[1].setDescription(embeds[1].description + "\n" + log)
        }
        const components = buttons.length != 0? [new MessageActionRow().addComponents(buttons)] : []
        message.edit({embeds: embeds, components: components})
    }
    
    client.on("interactionCreate", interaction => {
        console.log("INTERACTION: ", interaction);
        if (!interaction.isButton()) return
        if (interaction.channelId !== config['mod-beatmap-verify-channel-id']) return
    
        // If we accept/reject, update the embed and remove the components
        let accepted = false
        const message = <Message<boolean>> interaction.message

        const downloadURL = message.embeds[0]?.url
        const username = message.embeds[0]?.author.url
        const userAvatar = message.embeds[0]?.thumbnail.url

        if (interaction.customId === 'accept') {
            accepted = true;
            appendVerifierLog(`ACCEPTED by ${interaction.user.toString()}`, message, [])
            // We will remove our submission later, after we download everything.
        } else if (interaction.customId === 'reject') {
            const reopenButton = new MessageButton()
                    .setCustomId('reopen')
                    .setLabel(`Reopen`)
                    .setStyle('SECONDARY')
            appendVerifierLog(`REJECTED by ${interaction.user.toString()}`, message, [reopenButton])
            // Remove our submission
            if (!!downloadURL)
                onRejectSubmission(downloadURL)
            interaction.update({})
        } else if (interaction.customId === 'reopen') {
            const buttons = getDefaultMessageButtons()
            appendVerifierLog(`reopened by ${interaction.user.toString()}`, message, buttons)
            // Re-register our submission
            if (!!username && !!downloadURL) {
                onPostSubmission({
                    username: username,
                    avatarURL: !!userAvatar? userAvatar : "",
                    downloadURL: downloadURL
                })
            }
            interaction.update({})
        } else {
            console.error("INVALID INTERACTION ID: ", interaction.id)
            return;
        }

        if (accepted) {
            const downloadURL = getBeatmapDownloadURLFromVerifierPoll(message)
            if (!!downloadURL) {
                // TODO: Notify user that their beatmap has been accepted?
                // Accept server side
                onAcceptBeatmap(downloadURL, () => interaction.update({}))
            }
        }
    });

    client.login(readFileSync('bot-secret.txt', 'utf8')).then(() => {
        console.log("Client Logged in!");
        client.user?.setPresence({ activities: [{ name: config['bot-status'], url: config['bot-status-url'], type: config['bot-status-type'] }], status: 'online' });
        client.user?.setAvatar(config['bot-avatar'])
    })
}
