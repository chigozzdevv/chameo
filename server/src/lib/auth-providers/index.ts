export * from "./types";
export { githubProvider } from "./github";
export { twitterProvider } from "./twitter";
export { discordProvider } from "./discord";

import type { AuthProvider } from "./types";
import { githubProvider } from "./github";
import { twitterProvider } from "./twitter";
import { discordProvider } from "./discord";

export const authProviders: Record<string, AuthProvider> = {
  github: githubProvider,
  twitter: twitterProvider,
  discord: discordProvider,
};
