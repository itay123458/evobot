import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder, TextChannel } from "discord.js";
import { bot } from "../index";
import { MusicQueue } from "../structs/MusicQueue";
import { Song } from "../structs/Song";
import { i18n } from "../utils/i18n";
import { playlistPattern } from "../utils/patterns";

export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription(i18n.__("play.description"))
    .addStringOption((option) => option.setName("song").setDescription("The song you want to play").setRequired(true)),
  cooldown: 3,
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  async execute(interaction: ChatInputCommandInteraction, input: string) {
    let argSongName = interaction.options.getString("song");
    if (!argSongName) argSongName = input;

    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);
    const { channel } = guildMember!.voice;

    if (!channel)
      return interaction.reply({ content: i18n.__("play.errorNotChannel"), ephemeral: true }).catch(console.error);

    const queue = bot.queues.get(interaction.guild!.id);

    if (queue && channel.id !== (queue.player as any).connection?.channelId)
      return interaction
        .reply({
          content: i18n.__mf("play.errorNotInSameChannel", { user: bot.client.user!.username }),
          ephemeral: true
        })
        .catch(console.error);

    if (!argSongName)
      return interaction
        .reply({ content: i18n.__mf("play.usageReply", { prefix: bot.prefix }), ephemeral: true })
        .catch(console.error);

    const url = argSongName;

    if (interaction.replied) await interaction.editReply("⏳ Loading...").catch(console.error);
    else await interaction.reply("⏳ Loading...");

    if (playlistPattern.test(url)) {
      await interaction.editReply("🔗 Link is playlist").catch(console.error);
      return bot.slashCommandsMap.get("playlist")!.execute(interaction, "song");
    }

    const node = bot.shoukaku.options.nodeResolver(bot.shoukaku.nodes);
    if (!node) {
      return interaction.editReply({ content: i18n.__("common.errorCommand") }).catch(console.error);
    }

    let song;

    try {
      song = await Song.from(node, url, url);
    } catch (error: any) {
      console.error(error);

      if (error.name == "NoResults")
        return interaction
          .editReply({ content: i18n.__mf("play.errorNoResults", { url: `<${url}>` }) })
          .catch(console.error);

      if (error.name == "InvalidURL")
        return interaction
          .editReply({ content: i18n.__mf("play.errorInvalidURL", { url: `<${url}>` }) })
          .catch(console.error);

      return interaction.editReply({ content: i18n.__("common.errorCommand") }).catch(console.error);
    }

    if (queue) {
      queue.enqueue(song);

      return (interaction.channel as TextChannel)
        .send({ content: i18n.__mf("play.queueAdded", { title: song.title, author: interaction.user.id }) })
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
    newQueue.enqueue(song);
    interaction.deleteReply().catch(console.error);
  }
};
