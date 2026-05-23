import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CommandInteraction,
  GuildMember,
  Interaction,
  Message,
  TextChannel
} from "discord.js";
import { Node, Player } from "shoukaku";
import { bot } from "../index";
import { QueueOptions } from "../interfaces/QueueOptions";
import { config } from "../utils/config";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";
import { Song } from "./Song";
import { safeReply } from "../utils/safeReply";

export class MusicQueue {
  public readonly interaction: CommandInteraction;
  public readonly player: Player;
  public readonly node: Node;
  public readonly textChannel: TextChannel;
  public readonly bot = bot;

  public songs: Song[] = [];
  public volume = config.DEFAULT_VOLUME || 100;
  public loop = false;
  public muted = false;
  public waitTimeout: NodeJS.Timeout | null = null;
  public playing = false;

  private queueLock = false;
  private stopped = false;

  public constructor(options: QueueOptions) {
    Object.assign(this, options);

    this.player.on("start", () => {
      this.playing = true;
      this.sendPlayingMessage();
    });

    this.player.on("end", async (data: any) => {
      if (data?.reason === "replaced") return;
      if (this.stopped) return;

      this.playing = false;

      if (this.loop && this.songs.length) {
        this.songs.push(this.songs.shift()!);
      } else {
        this.songs.shift();
        if (!this.songs.length) return this.stop();
      }

      this.processQueue();
    });

    this.player.on("exception", (error: any) => {
      console.error(error);
      this.playing = false;
      this.songs.shift();
      this.processQueue();
    });

    this.player.on("closed", () => {
      this.playing = false;
      bot.queues.delete(this.interaction.guild!.id);
    });
  }

  public enqueue(...songs: Song[]) {
    if (this.waitTimeout !== null) clearTimeout(this.waitTimeout);
    this.waitTimeout = null;
    this.stopped = false;
    this.songs = this.songs.concat(songs);
    this.processQueue();
  }

  public stop() {
    if (this.stopped) return;

    this.stopped = true;
    this.loop = false;
    this.songs = [];
    this.playing = false;
    this.player.stopTrack();

    !config.PRUNING && this.textChannel.send(i18n.__("play.queueEnded")).catch(console.error);

    if (this.waitTimeout !== null) return;

    this.waitTimeout = setTimeout(() => {
      bot.shoukaku.leaveVoiceChannel(this.interaction.guild!.id);
      bot.queues.delete(this.interaction.guild!.id);
      !config.PRUNING && this.textChannel.send(i18n.__("play.leaveChannel"));
    }, config.STAY_TIME * 1000);
  }

  public async processQueue(): Promise<void> {
    if (this.queueLock || this.playing) return;
    if (!this.songs.length) return this.stop();

    this.queueLock = true;

    const next = this.songs[0];

    try {
      const track = await next.resolveTrack(this.node);
      await this.player.playTrack({ track });
      await this.player.setGlobalVolume(this.volume * 10);
    } catch (error) {
      console.error(error);
      this.songs.shift();
      this.queueLock = false;
      return this.processQueue();
    } finally {
      this.queueLock = false;
    }
  }

  public get position(): number {
    return this.player.position / 1000;
  }

  private async handleSkip(interaction: ButtonInteraction): Promise<void> {
    await this.bot.slashCommandsMap.get("skip")!.execute(interaction);
  }

  private async handlePlayPause(interaction: ButtonInteraction): Promise<void> {
    if (this.playing && !this.player.paused) {
      await this.bot.slashCommandsMap.get("pause")!.execute(interaction);
    } else {
      await this.bot.slashCommandsMap.get("resume")!.execute(interaction);
    }
  }

  private async handleMute(interaction: ButtonInteraction): Promise<void> {
    if (!canModifyQueue(interaction.member as GuildMember)) return;

    this.muted = !this.muted;

    if (this.muted) {
      await this.player.setGlobalVolume(0);
      safeReply(interaction, i18n.__mf("play.mutedSong", { author: interaction.user })).catch(console.error);
    } else {
      await this.player.setGlobalVolume(this.volume * 10);
      safeReply(interaction, i18n.__mf("play.unmutedSong", { author: interaction.user })).catch(console.error);
    }
  }

  private async handleDecreaseVolume(interaction: ButtonInteraction): Promise<void> {
    if (this.volume == 0) return;
    if (!canModifyQueue(interaction.member as GuildMember)) return;

    this.volume = Math.max(this.volume - 10, 0);
    await this.player.setGlobalVolume(this.volume * 10);

    safeReply(interaction, i18n.__mf("play.decreasedVolume", { author: interaction.user, volume: this.volume })).catch(
      console.error
    );
  }

  private async handleIncreaseVolume(interaction: ButtonInteraction): Promise<void> {
    if (this.volume == 100) return;
    if (!canModifyQueue(interaction.member as GuildMember)) return;

    this.volume = Math.min(this.volume + 10, 100);
    await this.player.setGlobalVolume(this.volume * 10);

    safeReply(interaction, i18n.__mf("play.increasedVolume", { author: interaction.user, volume: this.volume })).catch(
      console.error
    );
  }

  private async handleLoop(interaction: ButtonInteraction): Promise<void> {
    await this.bot.slashCommandsMap.get("loop")!.execute(interaction);
  }

  private async handleShuffle(interaction: ButtonInteraction): Promise<void> {
    await this.bot.slashCommandsMap.get("shuffle")!.execute(interaction);
  }

  private async handleStop(interaction: ButtonInteraction): Promise<void> {
    await this.bot.slashCommandsMap.get("stop")!.execute(interaction);
  }

  private commandHandlers = new Map([
    ["skip", this.handleSkip],
    ["play_pause", this.handlePlayPause],
    ["mute", this.handleMute],
    ["decrease_volume", this.handleDecreaseVolume],
    ["increase_volume", this.handleIncreaseVolume],
    ["loop", this.handleLoop],
    ["shuffle", this.handleShuffle],
    ["stop", this.handleStop]
  ]);

  private createButtonRow() {
    const firstRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("skip").setLabel("⏭").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("play_pause").setLabel("⏯").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("mute").setLabel("🔇").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("decrease_volume").setLabel("🔉").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("increase_volume").setLabel("🔊").setStyle(ButtonStyle.Secondary)
    );
    const secondRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("loop").setLabel("🔁").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("shuffle").setLabel("🔀").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("stop").setLabel("⏹").setStyle(ButtonStyle.Secondary)
    );

    return [firstRow, secondRow];
  }

  private async sendPlayingMessage() {
    const song = this.songs[0];
    if (!song) return;

    let playingMessage: Message;

    try {
      playingMessage = await this.textChannel.send({
        content: song.startMessage(),
        components: this.createButtonRow()
      });
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error) this.textChannel.send(error.message);
      return;
    }

    const filter = (i: Interaction) => i.isButton() && i.message.id === playingMessage.id;

    const collector = playingMessage.createMessageComponentCollector({
      filter,
      time: song.duration > 0 ? song.duration * 1000 : 60000
    });

    collector.on("collect", async (interaction) => {
      if (!interaction.isButton()) return;
      if (!this.songs) return;

      const handler = this.commandHandlers.get(interaction.customId);

      if (["skip", "stop"].includes(interaction.customId)) collector.stop();

      if (handler) await handler.call(this, interaction);
    });

    collector.on("end", () => {
      playingMessage.edit({ components: [] }).catch(console.error);

      if (config.PRUNING) {
        setTimeout(() => {
          playingMessage.delete().catch();
        }, 3000);
      }
    });
  }
}
