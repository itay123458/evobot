import { Node, Track } from "shoukaku";
import { i18n } from "../utils/i18n";
import { videoPattern, isURL } from "../utils/patterns";

export interface SongData {
  url: string;
  title: string;
  duration: number;
  track?: Track;
}

export class Song {
  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;
  public track?: Track;

  public constructor({ url, title, duration, track }: SongData) {
    this.url = url;
    this.title = title;
    this.duration = duration;
    this.track = track;
  }

  public static async from(node: Node, url: string = "", search: string = "") {
    const isYoutubeUrl = videoPattern.test(url);
    const query = isYoutubeUrl ? url : `ytsearch:${search}`;

    const result = await node.rest.resolve(query);

    if (!result || result.loadType === "empty" || result.loadType === "error") {
      const err = new Error(`No search results found for ${search}`);
      err.name = isURL.test(url) ? "InvalidURL" : "NoResults";
      throw err;
    }

    let track: Track;

    if (result.loadType === "track") {
      track = result.data as Track;
    } else if (result.loadType === "search") {
      const tracks = (result.data as any).tracks as Track[];
      if (!tracks?.length) {
        const err = new Error(`No search results found for ${search}`);
        err.name = "NoResults";
        throw err;
      }
      track = tracks[0];
    } else {
      const err = new Error(`Unexpected load type: ${result.loadType}`);
      err.name = "NoResults";
      throw err;
    }

    return new this({
      url: track.info.uri ?? url,
      title: track.info.title,
      duration: track.info.length / 1000,
      track
    });
  }

  public async resolveTrack(node: Node): Promise<Track> {
    if (this.track) return this.track;

    const result = await node.rest.resolve(this.url);

    if (!result || result.loadType === "empty" || result.loadType === "error") {
      throw new Error(`Failed to resolve track: ${this.url}`);
    }

    if (result.loadType === "track") {
      this.track = result.data as Track;
    } else {
      const tracks = (result.data as any).tracks as Track[];
      if (!tracks?.length) throw new Error(`No results for: ${this.url}`);
      this.track = tracks[0];
    }

    return this.track;
  }

  public startMessage() {
    return i18n.__mf("play.startedPlaying", { title: this.title, url: this.url });
  }
}
