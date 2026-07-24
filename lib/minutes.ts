// Draft structured board-meeting minutes from a transcript, using Claude.

import Anthropic from '@anthropic-ai/sdk'
import type { MeetingMinutes } from '@/types'

interface DraftContext {
  title: string
  date: string | null
  location: string | null
  attendees: string[]
}

const MINUTES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    date: { type: ['string', 'null'] },
    attendees: { type: 'array', items: { type: 'string' } },
    apologies: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    agenda_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          topic: { type: 'string' },
          discussion: { type: 'string' },
        },
        required: ['topic', 'discussion'],
      },
    },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          topic: { type: 'string' },
          decision: { type: 'string' },
          outcome: { type: ['string', 'null'] },
        },
        required: ['topic', 'decision', 'outcome'],
      },
    },
    action_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string' },
          owner: { type: ['string', 'null'] },
          due: { type: ['string', 'null'] },
        },
        required: ['action', 'owner', 'due'],
      },
    },
    next_meeting: { type: ['string', 'null'] },
  },
  required: [
    'title',
    'date',
    'attendees',
    'apologies',
    'summary',
    'agenda_items',
    'decisions',
    'action_items',
    'next_meeting',
  ],
} as const

/** Turn a raw transcript into structured minutes. */
export async function draftMinutes(
  transcript: string,
  ctx: DraftContext
): Promise<MeetingMinutes> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
  const client = new Anthropic()

  const knownAttendees = ctx.attendees.length
    ? `Board members expected to attend: ${ctx.attendees.join(', ')}.`
    : ''

  const prompt = `You are a professional minute-taker for a board of directors. Below is the transcript of an in-person board meeting. It was captured from a single microphone, so speaker labels ("Speaker A", "Speaker B", ...) are approximate — infer real names from context and the expected attendee list where you reasonably can.

Meeting title: ${ctx.title}
${ctx.date ? `Date: ${ctx.date}` : ''}
${ctx.location ? `Location: ${ctx.location}` : ''}
${knownAttendees}

Draft clear, formal minutes. Be faithful to what was actually said — do not invent decisions, motions, or action items that are not supported by the transcript. Where the transcript is unclear, keep it brief rather than guessing. Attribute motions and action items to a named person only when the transcript makes the owner clear; otherwise leave the owner null.

Transcript:
"""
${transcript}
"""`

  // Cast the params/response to `any`: `output_config` is an API-level field
  // that older SDK type definitions may not know about, but the SDK forwards it
  // to the API regardless. Keeping this loose lets the project build on any
  // installed SDK version while still using structured JSON output.
  const params = {
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    output_config: { format: { type: 'json_schema', schema: MINUTES_SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: any = await (client.messages.create as any)(params)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const block = (response.content as any[]).find((b) => b.type === 'text')
  if (!block?.text) throw new Error('No minutes returned')
  return JSON.parse(block.text) as MeetingMinutes
}
