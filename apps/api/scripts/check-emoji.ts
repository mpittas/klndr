/**
 * Asks OpenAI for an emoji exactly as the API does, to check that `OPENAI_API_KEY` and the model work,
 * without the app: `npm run emoji:check -w apps/api` or `npm run emoji:check -w apps/api -- "Gym session" Groceries`.
 * The key is read from `apps/api/.env` (see `.env.example`) or the environment.
 */
import { createEmojiSuggester, DEFAULT_EMOJI_MODEL } from "../src/emoji";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY is not set. Add it to apps/api/.env (see apps/api/.env.example) and run this again.");
  process.exit(1);
}

const model = process.env.EMOJI_MODEL || DEFAULT_EMOJI_MODEL;
const titles = process.argv.slice(2);
if (!titles.length) titles.push("Gym session", "Deep work", "Groceries", "Dentist appointment");

const suggest = createEmojiSuggester({ apiKey, model });
console.log(`Model: ${model}\n`);

let failed = 0;
for (const title of titles) {
  const started = performance.now();
  const emoji = await suggest(title, "activity");
  const ms = Math.round(performance.now() - started);
  if (emoji) {
    console.log(`${emoji}  ${title}  (${ms} ms)`);
  } else {
    failed += 1;
    console.log(`-  ${title}  no emoji after ${ms} ms: see the warning above for why`);
  }
}

process.exit(failed ? 1 : 0);
