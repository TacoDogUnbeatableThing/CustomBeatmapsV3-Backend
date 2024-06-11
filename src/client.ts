import { Client, Message, TextChannel, GuildMember, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, APIActionRowComponent, APIMessageActionRowComponent, APITextInputComponent, Attachment } from 'discord.js'
import { readFileSync } from "fs";

import { IBeatmapSubmission } from './data'

import { logger } from './publiclogger'

interface IRunClientArguments {
    onAcceptBeatmap : (attachmentName : string, beatmapURL : string, onComplete : () => void) => void;
    onPostSubmission : (submission : IBeatmapSubmission) => void;
    onRejectSubmission : (attachmentName : string) => void;
    config : any
}
export const runClient = ({onAcceptBeatmap, onPostSubmission, onRejectSubmission, config} : IRunClientArguments) : Promise<void> => {

    const client = new Client({
        intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
    		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.MessageContent
	]
    })

    const token = readFileSync('bot-secret.txt', 'utf8')

    const isUserSubmission = (message : Message<boolean>) : boolean =>  {
	const attachmentName = message.attachments.at(0)?.name.toString()
        return message.channelId === config["user-beatmap-submission-channel-id"]
                && !!attachmentName
                && (attachmentName.toLowerCase().endsWith(".zip") || attachmentName.toLowerCase().endsWith(".osz"));
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
    
    const getDefaultMessageButtons = () : ButtonBuilder[] => {
        return [
            new ButtonBuilder()
                .setCustomId('accept')
                .setLabel(`✅ Accept`)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('reject')
                .setLabel(`❌ Reject`)
                .setStyle(ButtonStyle.Danger)
        ];
    }

    const getSubmissionFilename = (attachmentURL : string | null | undefined) => {
        const attachmentURLParts = !!attachmentURL? attachmentURL.split('/') : []
        return attachmentURLParts.length != 0
            ? (attachmentURLParts[attachmentURLParts.length - 1]).split("?")[0]
            : "ERROR"
    }
    
    const receiveUserSubmission = (message : Message<boolean>) => {
        // Indicate we've received their submission
        // Post a simple poll to the "verification" area
        const channel = client.channels.cache.get(config["mod-beatmap-verify-channel-id"]) as TextChannel
        const pollPrompt = `${config["approve-reaction"]} to accept and upload, ${config["reject-reaction"]} to reject (DM creator with reason)`
    
        const attachment = message.attachments.at(0)

        const attachmentURL = attachment?.url.toString();
        const attachmentName = getSubmissionFilename(attachmentURL)

        const avatarURL = message.author.avatarURL()
        const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle(attachmentName)
                .setThumbnail(!!avatarURL? avatarURL : "")
                .setURL(!!attachmentURL? attachmentURL : message.url)
                .setAuthor({name: message.author.username})
                .setDescription(`${message.author.toString()}: ${message.content}\n${message.url}`);
    
        const buttons = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    getDefaultMessageButtons()
                )
    
        // Make sure our verifiers get an update first before confirming!
        channel.send({ embeds: [embed], components: [ buttons ] }).then(() => {
            message.react(config["processing-reaction"])
            if (!!attachmentURL) {
                onPostSubmission({
                    username: message.author.username,
                    avatarURL: !!avatarURL? avatarURL : "",
                    fileName : attachmentName,
                    downloadURL: attachmentURL
                })
            }
        });
    }
    
    client.on("messageCreate", message => {
        if (message.author.bot) return
        if (isUserSubmission(message)) {
            receiveUserSubmission(message)
        }
    });
    
    // Append a log message to a message that has 1 normal embed and 1 logging embed
    const appendVerifierLog = (log : string, message : Message<boolean>, buttons: ButtonBuilder[]) => {
    
        let embeds = message.embeds.map(embed => new EmbedBuilder(embed.data))
        if (embeds.length == 1) {
            embeds.push(new EmbedBuilder().setDescription(log))
        } else if (embeds.length == 2) {
            embeds[1] = embeds[1].setDescription(embeds[1].data.description + "\n" + log)
        }
        const components = buttons.length != 0? [ new ActionRowBuilder<ButtonBuilder>().addComponents(buttons) ] : []
        message.edit({embeds: embeds, components: components})
    }

    client.on("interactionCreate", async interaction => {
        if (!interaction.isButton()) return
        if (interaction.channelId !== config['mod-beatmap-verify-channel-id']) return

        // If we accept/reject, update the embed and remove the components
        let accepted = false
        const message = <Message<boolean>> interaction.message

        const downloadURL = message.embeds[0]?.url
        const username = message.embeds[0]?.author?.name
        const userAvatar = message.embeds[0]?.thumbnail?.url

        const attachmentName = getSubmissionFilename(downloadURL)

        if (interaction.customId === 'accept') {
            accepted = true;
            appendVerifierLog(`ACCEPTED by ${interaction.user.toString()}`, message, [])
            // We will remove our submission later, after we download everything.
        } else if (interaction.customId === 'reject') {
            const reopenButton = new ButtonBuilder()
                    .setCustomId('reopen')
                    .setLabel(`Reopen`)
                    .setStyle(ButtonStyle.Secondary)
            appendVerifierLog(`REJECTED by ${interaction.user.toString()}`, message, [reopenButton])
            // Remove our submission
            if (!!attachmentName)
                onRejectSubmission(attachmentName)
            interaction.update({})
        } else if (interaction.customId === 'reopen') {
            const buttons = getDefaultMessageButtons()
            appendVerifierLog(`reopened by ${interaction.user.toString()}`, message, buttons)
            // Re-register our submission
            if (!!username && !!downloadURL) {
                onPostSubmission({
                    username: username,
                    avatarURL: !!userAvatar? userAvatar : "",
                    fileName : attachmentName,
                    downloadURL: downloadURL
                })
            }
            interaction.update({})
        } else {
            logger.error("INVALID INTERACTION ID: ", interaction.id)
            return;
        }

        if (accepted) {
            const downloadURL = getBeatmapDownloadURLFromVerifierPoll(message)
            if (!!downloadURL) {
                // TODO: Notify user that their beatmap has been accepted?
                // Accept server side
                onAcceptBeatmap(attachmentName, downloadURL, () => interaction.update({}))
            }
        }
    });

    const hasRole = (member : GuildMember, roleId : string) => {
        const roles = member.roles
        return roles.cache.has(roleId)
    }

    return client.login(token).then(() => {
	console.log("Discord Client Logged in!");
        logger.info("Discord Client Logged in!");
        client.user?.setPresence({ activities: [{ name: config['bot-status'], url: config['bot-status-url'], type: config['bot-status-type'] }], status: 'online' });
    })
}
