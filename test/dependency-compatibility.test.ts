import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { meetingsSetChannelCommand } from '../src/commands/meetings/set-channel.js';
import { transcriptsShareCommand } from '../src/commands/transcripts/share.js';
import { transcriptsListCommand } from '../src/commands/transcripts/list.js';

test('channel assignment preserves the comma-separated IDs and rejects empty IDs', async () => {
  let variables: unknown;
  const client = { mutate: async (_query: string, args: unknown) => { variables = args; return { updateMeetingChannel: { id: 'channel' } }; } };
  const input = meetingsSetChannelCommand.inputSchema.parse({ ids: 'one, two', channel: 'channel' });
  await meetingsSetChannelCommand.handler(input, client as never);
  assert.deepEqual(variables, { input: { transcript_ids: ['one', 'two'], channel_id: 'channel' } });
  assert.equal(meetingsSetChannelCommand.inputSchema.safeParse({ ids: 'one, ', channel: 'channel' }).success, false);
});

test('sharing preserves recipients and expiry while rejecting malformed recipients', async () => {
  let variables: unknown;
  const client = { mutate: async (_query: string, args: unknown) => { variables = args; return { shareMeeting: { success: true } }; } };
  const input = transcriptsShareCommand.inputSchema.parse({ id: 'meeting', emails: 'a@example.com, b@example.com', expiry_days: '30' });
  await transcriptsShareCommand.handler(input, client as never);
  assert.deepEqual(variables, { input: { meeting_id: 'meeting', emails: ['a@example.com', 'b@example.com'], expiry_days: 30 } });
  assert.equal(transcriptsShareCommand.inputSchema.safeParse({ id: 'meeting', emails: 'a@example.com,' }).success, false);
});

test('transcript pagination retains its default and rejects out-of-range input', () => {
  assert.equal(transcriptsListCommand.inputSchema.parse({}).limit, 10);
  assert.equal(transcriptsListCommand.inputSchema.parse({ limit: '20' }).limit, 20);
  assert.equal(transcriptsListCommand.inputSchema.safeParse({ limit: 51 }).success, false);
});

test('the upgraded SDK advertises every MCP tool over stdio with valid schemas', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', 'src/mcp.ts'],
    env: { PATH: process.env.PATH ?? '', FIREFLIES_API_KEY: 'offline-compatibility-test' },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'offline-compatibility-test', version: '1' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.equal(tools.length, 32);
    const share = tools.find(tool => tool.name === 'transcripts_share');
    assert.equal(share?.inputSchema.type, 'object');
    assert.equal(share?.inputSchema.properties?.emails?.type, 'string');
    assert.ok(share?.inputSchema.required?.includes('emails'));
    const invalid = await client.callTool({ name: 'transcripts_list', arguments: { limit: 0 } });
    assert.equal(invalid.isError, true);
  } finally {
    await client.close();
  }
});
