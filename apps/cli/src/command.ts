// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

export interface CliOption {
  name: string
  short?: string
  type: 'string' | 'boolean'
  valueName?: string
  description: string
  defaultValue?: string | boolean
  choices?: string[]
  group: 'output' | 'other'
}

export interface CliCommand {
  name: string
  summary: string
  usage: string
  input: {
    name: string
    description: string[]
  }
  options: CliOption[]
  examples: string[]
}

export const renderCommand = {
  name: 'render',
  summary: 'Render NetworkGraph YAML/JSON to SVG/HTML/PNG',
  usage: 'shumoku render [options] <input>',
  input: {
    name: '<input>',
    description: [
      'NetworkGraph YAML or JSON file (use - for stdin)',
      'Format auto-detected from extension (.yaml, .yml, .json)',
    ],
  },
  options: [
    {
      name: 'format',
      short: 'f',
      type: 'string',
      valueName: 'type',
      description: 'Output format',
      defaultValue: 'auto from extension',
      choices: ['svg', 'html', 'png'],
      group: 'output',
    },
    {
      name: 'output',
      short: 'o',
      type: 'string',
      valueName: 'file',
      description: 'Output file',
      defaultValue: 'output.svg',
      group: 'output',
    },
    {
      name: 'theme',
      type: 'string',
      valueName: 'theme',
      description: 'Theme',
      defaultValue: 'light',
      choices: ['light', 'dark'],
      group: 'output',
    },
    {
      name: 'scale',
      type: 'string',
      valueName: 'number',
      description: 'PNG scale factor',
      defaultValue: '2',
      group: 'output',
    },
    {
      name: 'help',
      short: 'h',
      type: 'boolean',
      description: 'Show help',
      defaultValue: false,
      group: 'other',
    },
    {
      name: 'version',
      short: 'v',
      type: 'boolean',
      description: 'Show version',
      defaultValue: false,
      group: 'other',
    },
  ],
  examples: [
    'shumoku render network.yaml -o diagram.svg',
    'shumoku render network.yaml -f html -o diagram.html',
    'shumoku render network.yaml -f png -o diagram.png',
    'shumoku render topology.json -o diagram.svg',
    'cat network.yaml | shumoku render - -o diagram.svg',
  ],
} satisfies CliCommand

export function createParseArgsOptions(command: CliCommand) {
  return Object.fromEntries(
    command.options.map((option) => [
      option.name,
      {
        type: option.type,
        ...(option.short ? { short: option.short } : {}),
        ...(option.defaultValue === undefined || option.name === 'format'
          ? {}
          : {
              default: option.name === 'output' ? 'output' : option.defaultValue,
            }),
      },
    ]),
  )
}

function optionLabel(option: CliOption): string {
  const long = `--${option.name}${option.valueName ? ` <${option.valueName}>` : ''}`
  return option.short ? `-${option.short}, ${long}` : long
}

function optionDescription(option: CliOption): string {
  const choices = option.choices ? `: ${option.choices.join('|')}` : ''
  const defaultValue =
    option.defaultValue === undefined || option.defaultValue === false
      ? ''
      : ` (default: ${option.defaultValue})`
  return `${option.description}${choices}${defaultValue}`
}

export function renderCommandHelp(version: string): string {
  const lines = [
    ``,
    `shumoku v${version} - ${renderCommand.summary}`,
    '',
    `Usage: ${renderCommand.usage}`,
    '',
  ]
  lines.push('Input:')
  for (const [index, description] of renderCommand.input.description.entries()) {
    lines.push(`${index === 0 ? renderCommand.input.name.padEnd(20) : ''.padEnd(20)}${description}`)
  }
  lines.push('', 'Output:')
  for (const option of renderCommand.options.filter(({ group }) => group === 'output')) {
    lines.push(`  ${optionLabel(option).padEnd(22)}${optionDescription(option)}`)
  }
  lines.push('', 'Other:')
  for (const option of renderCommand.options.filter(({ group }) => group === 'other')) {
    lines.push(`  ${optionLabel(option).padEnd(22)}${optionDescription(option)}`)
  }
  lines.push('', 'Examples:')
  for (const example of renderCommand.examples) lines.push(`  ${example}`)
  return `${lines.join('\n')}\n`
}
