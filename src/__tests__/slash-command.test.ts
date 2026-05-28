import { readFileSync } from 'fs'

function readQueenCommand(): string {
  return readFileSync(new URL('../../.claude/commands/queen.md', import.meta.url), 'utf8')
}

test('/queen command preserves the dashboard instead of summarizing or rerunning it', () => {
  const command = readQueenCommand()

  expect(command).toContain('Run this command exactly once')
  expect(command).toContain('Do not call `/queen`')
  expect(command).toContain('Do not summarize')
  expect(command).toContain('preserve the dashboard line breaks')
  expect(command).toContain('Do not rerun')
  expect(command).toContain('Do not use the Atlassian MCP')
  expect(command).toContain('Plan writes must update the Jira description')
  expect(command).not.toContain('Render the output back')
  expect(command).not.toContain('Do not paste a giant raw terminal wall')
})
