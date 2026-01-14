export * from "./handler.types";
export { githubHandler } from "./github.handler";
export { twitterHandler } from "./twitter.handler";
export { discordHandler } from "./discord.handler";
import type { SocialHandler } from "./handler.types";
import { githubHandler } from "./github.handler";
import { twitterHandler } from "./twitter.handler";
import { discordHandler } from "./discord.handler";
export const socialHandlers: Record<string, SocialHandler> = {
  github: githubHandler,
  twitter: twitterHandler,
  discord: discordHandler,
};
