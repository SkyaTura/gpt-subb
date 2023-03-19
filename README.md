# GPT Subb

> `gpt-subb` is a command-line tool to translate and convert subtitles using OpenAI's Chat-GPT language model

## First things first

- This tool is not intended to be used commercially.
- Only translate subtitles of files/videos that you legally own.
- Do not use this tool to publish unauthorized translations of media you don't have rights to.
- Yes, a portion of this code (and also the documentation) was written by Chat-GPT itself.

I made this tool part as a joke and part as a experiment out of an idea given by a friend. Feel free to contact me if you want a more professional software to this purpose.

_We also won't refuse a couple of beer donations if you find this useful somehow._ 🍻

## Installation

To install `gpt-subb`, you need to have Node.js and npm (Node Package Manager) installed on your system. Once you have these installed, you can run the following command in your terminal:

```bash
npm install -g gpt-subb
```

This will install the tool globally on your system, making it available for use in any directory.

## Usage

### Prerequisites

To use the tool, you will need an OpenAI API key, which can be obtained at <https://platform.openai.com/account/api-keys>.

### Command

The `gpt-subb` command requires an input file to be translated as a mandatory argument and an output file as an optional argument. The tool will create the output file with the translated subtitles. If no output file is specified, the tool will create a new file in the same directory with the same name as the input file and the language code appended to the basename.

```bash
gpt-subb <input-file> [output-file]
```

### Options

- `-k, --key <key>`: OpenAI API Key. You can get one [here](https://platform.openai.com/account/api-keys). **Required**.
- `-b, --batch-size <number>`: Maximum number of messages to be sent in a single prompt. Default is `15`.
= `-l, --language <language>`: Language code to be used in the translation. Default is `en-us`.
- `-p, --prompt <prompt>`: Prompt format to be sent to the OpenAI API. Default format is `Translate the following text into [lang] but keep the 6 digit codes between < > intact:\n\n[text]`.
- `-f, --format <output-format>`: Format of the output file. Supported formats are `SRT` and `WebVTT`. Default is `SRT`.
- `-m, --model <model>`: OpenAI Model to be used for the translation. Default is gpt-3.5-turbo.
- `--temperature <number>`: OpenAI Temperature to be used for the translation. Default is `0.4`.

### Environment variables

Any option of this tool can be defined through environment variable or a `.env` file placed in the directory from where you are running the command.

_Example:_

```.env
GPTSUBB_KEY="ABC-123-XYZ"
GPTSUBB_LANGUAGE="en-us"
```

### Examples

Translate the input.srt file to Portuguese (pt-br) and save the result to output.srt file:

```bash
gpt-subb -k YOUR_API_KEY -l pt-br input.srt output.srt 
```

Translate the `movie.srt` file to French (fr) and save the result to `movie.fr.vtt` file:

```bash
gpt-subb -l fr -f WebVTT movie.srt
```
