import youtubedl from "youtube-dl-exec";
import { AudioResource, createAudioResource, StreamType } from "@discordjs/voice";
import youtube from "youtube-sr";
import { i18n } from "../utils/i18n";
import { videoPattern, isURL } from "../utils/patterns";

export interface SongData {
  url: string;
  title: string;
  duration: number;
}

export class Song {
  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;

  public constructor({ url, title, duration }: SongData) {
    this.url = url;
    this.title = title;
    this.duration = duration;
  }

  public static async from(url: string = "", search: string = "") {
    const isYoutubeUrl = videoPattern.test(url);

    let video;

    if (isYoutubeUrl) {
      video = await youtube.getVideo(url);
    } else {
      video = await youtube.searchOne(search);
    }

    if (!video) {
      const err = new Error(`No search results found for ${search}`);
      err.name = isURL.test(url) ? "InvalidURL" : "NoResults";
      throw err;
    }

    return new this({
      url: `https://youtube.com/watch?v=${video.id}`,
      title: video.title!,
      duration: video.duration / 1000
    });
  }

  public async makeResource(): Promise<AudioResource<Song>> {
    const proc = youtubedl.exec(this.url, {
      output: "-",
      quiet: true,
      format: "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio"
    });

    if (!proc.stdout) throw new Error("yt-dlp: no output stream");

    return createAudioResource(proc.stdout, {
      metadata: this,
      inputType: StreamType.Arbitrary,
      inlineVolume: true
    });
  }

  public startMessage() {
    return i18n.__mf("play.startedPlaying", { title: this.title, url: this.url });
  }
}
