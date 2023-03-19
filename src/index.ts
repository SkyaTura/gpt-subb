import { promises as fs } from 'node:fs';
import * as Path from 'node:path'
import { Command, Option } from '@commander-js/extra-typings';
import { inspect } from 'util'
import { Configuration, OpenAIApi } from "openai"
import { Format, parseSync, stringifySync } from 'subtitle'
import * as dotenv from 'dotenv'
dotenv.config()

const program = new Command()
  .argument('<input-file>', 'The input file to be translated')
  .argument('[output-file]', 'The path to the output file to be created. If the file already exists, it will be overwritten. If omitted, the file will be created in the same directory as the input file with the same name and the language code appended to the basename.')
  .addOption(
    new Option('-k, --key <key>', 'OpenAI API Key. You can get one at https://platform.openai.com/account/api-keys')
      .env('GPTSUBB_KEY')
      .makeOptionMandatory()
  )
  .addOption(
    new Option('-b, --batch-size <number>', 'Maximum number of messages to be sent in a single prompt')
      .argParser((value) => parseInt(value, 10))
      .default(15)
      .env('GPTSUBB_TOKENS')
  )
  .addOption(
    new Option('-l, --language <language>', 'Language code to be used in the translation')
      .default('en-us')
      .env('GPTSUBB_LANGUAGE')
  )
  .addOption(new Option('-p, --prompt <prompt>', 'Prompt format')
    .default('Translate the following text into [lang] but keep the 6 digit codes between < > intact:\n\n[text]')
    .env('GPTSUBB_PROMPT')
  )
  .addOption(new Option('-f, --format <output-format>', 'Format of the output file')
    .choices(['SRT', 'WebVTT'] as const)
    .default('SRT')
    .env('GPTSUBB_OUTPUT_TYPE')
  )
  .addOption(new Option('-m, --model <model>', 'OpenAI Model (Docs: https://platform.openai.com/docs/api-reference/chat/create#chat/create-temperature)')
    .default('gpt-3.5-turbo')
    .env('GPTSUBB_MODEL')
  )
  .addOption(new Option('--temperature <number>', 'OpenAI Temperature (Docs: https://platform.openai.com/docs/api-reference/chat/create#chat/create-model)')
    .argParser((value) => parseFloat(value))
    .default(0.4)
    .env('GPTSUBB_TEMPERATURE')
  )
  .parse()

const options = program.opts()

const configuration = new Configuration({
  apiKey: options.key
});
const openai = new OpenAIApi(configuration);

const randomCode = (alpha: number, number: number) => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lettersLength = letters.length
  return [
    ...Array(alpha).fill(null).map(() => letters[Math.floor(Math.random() * lettersLength)]),
    ...Array(number).fill(null).map(() => Math.floor(Math.random() * 10)),
  ].join('')
}

const readFile = async (filePath: string): Promise<string> => {
  console.debug(`Reading file ${filePath}...`)
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return data;
  } catch (error) {
    console.error(error);
    throw new Error('Ocorreu um erro ao ler o arquivo.');
  }
}


const writeFile = async (filePath: string, content: string): Promise<void> => {
  console.debug(`Writing file ${filePath}...`)
  try {
    await fs.writeFile(filePath, content);
    console.info(`O arquivo ${filePath} foi criado com sucesso.`);
  } catch (error) {
    console.error(error);
    throw new Error('Ocorreu um erro ao criar o arquivo.');
  }
}

const parseFile = (content: string) => {
  console.debug('Parsing content...')
  return parseSync(content).map((item) => ({
    ...item,
    code: randomCode(3, 3),
  }))
}

const getMessageQueue = (parsed: ReturnType<typeof parseFile>, batchSize = 15) => {
  const cues = parsed.map(({ type, code, data }) => type === 'cue' && !!data?.text ? `<${code}>\n${data.text}` : null).filter(Boolean) as string[]
  const batches = Math.ceil(cues.length / batchSize)
  return Array(batches).fill(null).map((_, index) => cues.slice(index * batchSize, (index + 1) * batchSize))
}

const getChatGPTAnswer = async (prompt: string) => {
  const completion = await openai.createChatCompletion({
    model: options.model,
    messages: [{ content: prompt, role: "user" }],
    temperature: options.temperature,
  }).catch(error => {
    console.error('Prompt failed', { prompt, error })
    return null
  });
  return completion?.data.choices[0].message?.content as string | null
}
const translateQueue = async (queue: string[]) => {
  const prompt = options.prompt.replace('[lang]', options.language).replace('[text]', queue.join(`\n<000000>\n`))
  const translation = await getChatGPTAnswer(prompt)
  if (!translation) return queue
  return translation.replace(/^\s*(.*)\s*$/gm, '$1').split('\n<000000>\n')
}
const translateQueues = async (queues: string[][]) => {
  const result: string[] = []
  const length = queues.length
  console.debug(`Translating queues (${length})...`)
  for (const queueIndex in queues) {
    const progress = parseInt(queueIndex, 10) + 1
    const queue = queues[queueIndex]
    console.debug(`Translating queue ${progress} of ${length}...`)
    const queueResult = await translateQueue(queue)
    if (queueResult !== queue)
      console.debug(`Translating queue ${progress} of ${length}... done!`)
    else
      console.debug(`Translating queue ${progress} of ${length}... failed! (skipping)`)
    result.push(...queueResult)
  }
  console.debug(`Translating queues (${length})... done`)
  return result
}
const translatedToCues = (translated: string[]) => {
  console.debug('Converting translated cues to objects...')
  const cues = translated.map(item => {
    const [_, code, text] = item.matchAll(/<([A-Z0-9]{6})>\n(.*)/gm).next().value
    if (!code || !text) return null
    return { code, text }
  }).filter(Boolean)
  console.debug('Converting translated cues to objects... done!')
  return cues as { code: string, text: string }[]
}

const applyTranslationCues = (parsed: ReturnType<typeof parseFile>, translations: { code: string, text: string }[]) => {
  const map = new Map(translations.map(({ code, text }) => [code, text]))
  return parsed.map(item => ({ ...item, translated: map.get(item.code) ?? null }))
}

const prepareOutput = (translated: ReturnType<typeof applyTranslationCues>) => translated.map(item => {
  if (!item.translated || item.type !== 'cue' || !item.data) return item
  const { code: _code, translated, ...rest } = item
  return {
    ...rest,
    data: { ...item.data, text: translated }
  }
})

const main = async () => {
  const inputFile = Path.resolve(program.processedArgs[0])
  const outputExtension = options.format === 'WebVTT' ? 'vtt' : 'srt'
  const outputFile = program.processedArgs[1] ?? Path.resolve(
    [
      Path.basename(inputFile, Path.extname(inputFile)),
      options.language
        .toLocaleLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/( |-){1,}/g, '-'),
      outputExtension
    ].join('.')
  )

  const input = await readFile(inputFile)
  const parsed = parseFile(input)
  const messages = getMessageQueue(parsed, options.batchSize)
  const translated = await translateQueues(messages)
  console.log(inspect(translated, { depth: 20, colors: true }))
  const translatedCues = translatedToCues(translated)
  console.debug('Applying translated cues...')
  const translatedSubtitles = applyTranslationCues(parsed, translatedCues)
  console.debug('Preparing output...')
  const preparedOutput = prepareOutput(translatedSubtitles)
  console.debug('Creating output file...')
  const output = stringifySync(preparedOutput, { format: options.format as Format })
  console.debug('Writing output file...')
  await writeFile(outputFile, output)

  console.info('Done!')
}

main().then(() => console.log('Success!')).catch((error) => console.error(error)).then(() => process.exit(0));