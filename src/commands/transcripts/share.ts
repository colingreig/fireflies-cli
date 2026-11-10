import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';

const SHARE_MUTATION = `
  mutation ShareMeeting($input: ShareMeetingInput!) {
    shareMeeting(input: $input) {
      success
      message
      share_slug
    }
  }
`;

export const transcriptsShareCommand: CommandDefinition = {
  name: 'transcripts_share',
  group: 'transcripts',
  subcommand: 'share',
  description:
    'Share a transcript with a list of email addresses (up to 100). Rate limited to 10 requests/hour.',
  examples: [
    'fireflies transcripts share abc123 --emails alice@co.com,bob@co.com',
    'fireflies transcripts share abc123 --emails alice@co.com --expiry-days 30',
  ],
  inputSchema: z.object({
    id: z.string().min(1),
    emails: z
      .string()
      .min(1)
      .refine(
        (emails) => {
          const parsed = emails.split(',').map((email) => email.trim());
          return (
            parsed.length <= 100 &&
            parsed.every((email) => z.string().email().safeParse(email).success)
          );
        },
        'Provide 1-100 comma-separated valid email addresses',
      ),
    expiry_days: z.coerce.number().int().positive().optional(),
  }),
  cliMappings: {
    args: [{ field: 'id', name: 'id', required: true, description: 'Transcript ID' }],
    options: [
      {
        field: 'emails',
        flags: '--emails <emails>',
        description: 'Comma-separated email addresses (max 100)',
      },
      { field: 'expiry_days', flags: '--expiry-days <n>', description: 'Expiry in days' },
    ],
  },
  handler: async (input, client) => {
    const emails = z.string().parse(input.emails).split(',').map((e: string) => e.trim());
    const inputArg: Record<string, unknown> = { meeting_id: input.id, emails };
    if (input.expiry_days !== undefined) inputArg['expiry_days'] = input.expiry_days;

    const data = await client.mutate<{ shareMeeting: unknown }>(SHARE_MUTATION, {
      input: inputArg,
    });
    return data.shareMeeting;
  },
};
