export * from "./types";
export { githubProvider } from "./github";
export { twitterProvider } from "./twitter";
export { discordProvider } from "./discord";
export { telegramProvider } from "./telegram";

import type { AuthProvider } from "./types";
import { githubProvider } from "./github";
import { twitterProvider } from "./twitter";
import { discordProvider } from "./discord";
import { telegramProvider } from "./telegram";

export const authProviders: Record<string, AuthProvider> = {
  github: githubProvider,
  twitter: twitterProvider,
  discord: discordProvider,
  telegram: telegramProvider,
};
