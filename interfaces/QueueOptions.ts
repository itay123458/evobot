import { Node, Player } from "shoukaku";
import { CommandInteraction, TextChannel } from "discord.js";

export interface QueueOptions {
  interaction: CommandInteraction;
  textChannel: TextChannel;
  player: Player;
  node: Node;
}
