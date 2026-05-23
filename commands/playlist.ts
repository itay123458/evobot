import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  TextChannel
} from "discord.js";
import { bot } from "../index";
import { MusicQueue } from "../structs/MusicQueue";
import { Playlist } from "../structs/Playlist";
import { Song } from "../structs/Song";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("playlist")
    .setDescription(i18n.__("playlist.description"))
    .addStringOption((option) => option.setName("playlist").setDescription("Playlist name or link").setRequired(true)),
  cooldown: 5,
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  async execute(interaction: ChatInputCommandInteraction, queryOptionName = "playlist") {
    let argSongName = interaction.options.getString(queryOptionName);

    const guildMemer = interaction.guild!.members.cache.get(interaction.user.id);
    const { channel } = guildMemer!.voice;

    const queue = bot.queues.get(interaction.guild!.id);

    if (!channel)
      return interaction.reply({ content: i18n.__("playlist.errorNotChannel"), ephemeral: true }).catch(console.error);

    if (queue && channel.id !== (queue.player as any).connection?.channelId) {
      if (interaction.replied)
        return interaction
          .editReply({ content: i18n.__mf("play.errorNotInSameChannel", { user: interaction.client.user!.username }) })
          .catch(console.error);
      else
        return interaction
          .reply({
            content: i18n.__mf("play.errorNotInSameChannel", { user: interaction.client.user!.username }),
            ephemeral: true
          })
          .catch(console.error);
    }

    let playlist;

    try {
      playlist = await Playlist.from(argSongName!.split(" ")[0], argSongName!);
    } catch (error) {
      console.error(error);

      if (interaction.replied)
        return interaction.editReply({ content: i18n.__("playlist.errorNotFoundPlaylist") }).catch(console.error);
      else
        return interaction
          .reply({ content: i18n.__("playlist.errorNotFoundPlaylist"), ephemeral: true })
          .catch(console.error);
    }

    if (queue) {
      queue.songs.push(...playlist.videos);
    } else {
      const node = bot.shoukaku.options.nodeResolver(bot.shoukaku.nodes);
      if (!node) {
        return interaction
          .reply({ content: i18n.__("common.errorCommand"), ephemeral: true })
          .catch(console.error);
      }

      const player = await bot.shoukaku.joinVoiceChannel({
        guildId: channel.guild.id,
        channelId: channel.id,
        shardId: channel.guild.shardId,
        deaf: true
      });

      const newQueue = new MusicQueue({
        interaction,
        textChannel: interaction.channel! as TextChannel,
        player,
        node
      });

      bot.queues.set(interaction.guild!.id, newQueue);
      newQueue.enqueue(...playlist.videos);
    }

    let playlistEmbed = new EmbedBuilder()
      .setTitle(`${playlist.data.title}`)
      .setDescription(
        playlist.videos
          .map((song: Song, index: number) => `${index + 1}. ${song.title}`)
          .join("\n")
          .slice(0, 4095)
      )
      .setURL(playlist.data.url!)
      .setColor("#F8AA2A")
      .setTimestamp();

    if (interaction.replied)
      return interaction.editReply({
        content: i18n.__mf("playlist.startedPlaylist", { author: interaction.user.id }),
        embeds: [playlistEmbed]
      });
    interaction
      .reply({
        content: i18n.__mf("playlist.startedPlaylist", { author: interaction.user.id }),
        embeds: [playlistEmbed]
      })
      .catch(console.error);
  }
};
