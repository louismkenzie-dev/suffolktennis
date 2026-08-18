/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  eventTitle?: string
  parentName?: string
  parentEmail?: string
  parentPhone?: string
  parentClub?: string
  playerCoach?: string
  childName?: string
  childDob?: string
  childGender?: string
  sessionSlot?: string
  medicalNotes?: string
  photoConsent?: boolean
}

const Email = (p: Props) => (
  <Html lang="en">
    <Head />
    <Preview>New Rising Stars sign-up: {p.childName ?? 'child'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Rising Stars sign-up</Heading>
        <Text style={sub}>{p.eventTitle}</Text>
        <Hr style={hr} />
        <Row label="Parent" value={p.parentName} />
        <Row label="Email" value={p.parentEmail} />
        <Row label="Phone" value={p.parentPhone} />
        <Row label="Parent's club" value={p.parentClub} />
        <Row label="Player's coach" value={p.playerCoach} />
        <Hr style={hr} />
        <Row label="Child" value={p.childName} />
        <Row label="DOB" value={p.childDob} />
        <Row label="Gender" value={p.childGender} />
        <Row label="Session" value={p.sessionSlot} />
        <Row label="Medical notes" value={p.medicalNotes} />
        <Row label="Photo consent" value={p.photoConsent ? 'Yes' : 'No'} />
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <Section style={{ padding: '4px 0' }}>
    <Text style={rowLabel}>{label}</Text>
    <Text style={rowValue}>{value || '—'}</Text>
  </Section>
)

export const template = {
  component: Email,
  subject: (d: Props) => `New Rising Stars sign-up — ${d?.childName ?? 'child'}`,
  displayName: 'Rising Stars admin notification',
  previewData: {
    eventTitle: 'Suffolk Rising Stars Fun Morning',
    parentName: 'Sam Smith',
    parentEmail: 'sam@example.com',
    parentPhone: '07123 456789',
    parentClub: 'Ipswich Sports Club',
    playerCoach: 'James Yates',
    childName: 'Alex Smith',
    childDob: '2020-05-14',
    childGender: 'Male',
    sessionSlot: 'Age 4–5',
    medicalNotes: 'None',
    photoConsent: true,
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '24px' }
const h1: React.CSSProperties = { color: '#0a1e3c', fontSize: '22px', margin: 0 }
const sub: React.CSSProperties = { color: '#5d6b80', fontSize: '14px', margin: '4px 0 0' }
const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #dfe6ee', margin: '16px 0' }
const rowLabel: React.CSSProperties = { color: '#7a8699', fontSize: '11px', letterSpacing: '1px', fontWeight: 700, margin: 0, textTransform: 'uppercase' }
const rowValue: React.CSSProperties = { color: '#0a1e3c', fontSize: '15px', margin: '2px 0 0' }
