// ─── Users ───────────────────────────────────────────────────
export type UserRole = 'owner' | 'staff'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
}

// ─── Contacts (clients / people) ─────────────────────────────
export type ContactStatus = 'prospect' | 'active' | 'inactive'

export interface Contact {
  id: string
  name: string
  organization: string | null
  email: string | null
  phone: string | null
  status: ContactStatus
  /** Standing dietary needs, used as the default when registering for an event. */
  dietary_needs: string | null
  /** Standing accommodation notes, used as the default when registering for an event. */
  accommodation_notes: string | null
  /** Free-form labels for organising and filtering (e.g. "Speakers", "VIPs"). */
  groups: string[]
  notes: string | null
  last_contact_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ─── Interactions (relationship log) ─────────────────────────
export type InteractionType = 'call' | 'email' | 'meeting' | 'conference' | 'note' | 'other'

export interface Interaction {
  id: string
  type: InteractionType
  subject: string
  notes: string | null
  outcome: string | null
  date: string
  contact_id: string | null
  event_id: string | null
  logged_by: string | null
  created_at: string
  contact?: Contact
  event?: Event
}

// ─── Reminders / follow-ups ──────────────────────────────────
export interface Reminder {
  id: string
  title: string
  notes: string | null
  due_date: string
  completed: boolean
  completed_at: string | null
  contact_id: string | null
  event_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  contact?: Contact
  event?: Event
}

// ─── Events (conferences) ────────────────────────────────────
export type EventStatus = 'draft' | 'upcoming' | 'active' | 'completed' | 'cancelled'

export interface Event {
  id: string
  name: string
  description: string | null
  location: string | null
  starts_at: string | null
  ends_at: string | null
  /** Link to a hosted agenda (PDF, web page, etc.) offered to attendees. */
  agenda_url: string | null
  status: EventStatus
  /** Main meeting venue. */
  venue: string | null
  /** Where the conference dinner(s) are held. */
  dinner_venue: string | null
  /** Catering contact (name / phone / email). */
  catering_contact: string | null
  /** Coordinator who supplies the attendee list for this event. */
  key_contact_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  key_contact?: Contact
}

// ─── Registrations (a contact signed up to an event) ─────────
// 'invited'   — added to the event, not yet responded
// 'signed_up' — confirmed attending
// 'declined'  — said no
// 'attended'  — showed up
// 'no_show'   — confirmed but did not attend
export type RegistrationStatus = 'invited' | 'signed_up' | 'declined' | 'attended' | 'no_show'

export interface Registration {
  id: string
  event_id: string
  contact_id: string
  status: RegistrationStatus
  accommodation_needed: boolean
  accommodation_notes: string | null
  dietary_needs: string | null
  /** Which days / dinners this attendee is coming to. */
  day1_attending: boolean
  day2_attending: boolean
  dinner1_attending: boolean
  dinner2_attending: boolean
  /** Travel / flight details for this attendee. */
  travel_notes: string | null
  /** Accommodation arrival/departure for this attendee (may differ from event dates). */
  arrival_date: string | null
  departure_date: string | null
  /** When the agenda was emailed to this attendee. */
  agenda_sent_at: string | null
  /** When the signup/notification email was sent. */
  notified_at: string | null
  /** When the attendee replied to a notification. Null = no reply yet. */
  replied_at: string | null
  response_notes: string | null
  created_at: string
  updated_at: string
  contact?: Contact
  event?: Event
}

// ─── Run sheet (order of the day) ────────────────────────────
export interface RunSheetItem {
  id: string
  event_id: string
  day: string | null
  start_time: string | null
  title: string | null
  presenter: string | null
  location: string | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// ─── Budget line items ───────────────────────────────────────
export interface BudgetItem {
  id: string
  event_id: string
  category: string | null
  estimated: number | null
  actual: number | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// ─── Emails (Gmail sync + reply tracking) ────────────────────
export interface Email {
  id: string
  gmail_id: string | null
  message_id: string | null
  thread_id: string | null
  from_email: string
  from_name: string | null
  subject: string
  body_text: string | null
  received_at: string
  is_read: boolean
  contact_id: string | null
  event_id: string | null
  registration_id: string | null
  created_at: string
  contact?: Contact
}

// ─── Gmail connection ────────────────────────────────────────
export interface GmailToken {
  id: string
  email: string
  expires_at: string
  created_at: string
  updated_at: string
}

// ─── Email templates (template auto-responses) ───────────────
// `key` is a stable slug used by automation, e.g. 'agenda', 'no_reply_chase'.
// Bodies support {{placeholders}} like {{contact_name}}, {{event_name}}.
export interface EmailTemplate {
  id: string
  key: string
  name: string
  subject: string
  body: string
  created_at: string
  updated_at: string
}

// ─── Dashboard stats ─────────────────────────────────────────
export interface CRMStats {
  totalContacts: number
  activeContacts: number
  upcomingEvents: number
  pendingReplies: number
  recentInteractions: Interaction[]
}
