/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  parentName?: string
  childName?: string
  eventTitle?: string
  eventDateLabel?: string
  location?: string
  sessionSlot?: string
  siteUrl?: string
}

const Email = ({
  parentName = 'there',
  childName = 'your child',
  eventTitle = 'Suffolk Rising Stars Fun Morning',
  eventDateLabel = 'TBC',
  location = 'TBC',
  sessionSlot,
  siteUrl = 'https://suffolktennis.online',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're booked in for {eventTitle} — see you on court!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>SUFFOLK TENNIS</Heading>
          <Text style={tagline}>Rising Stars</Text>
        </Section>

        <Section style={hero}>
          <Heading style={h1}>You're in! 🎾</Heading>
          <Text style={lead}>
            Hi {parentName}, thanks for signing {childName} up to <strong>{eventTitle}</strong>.
            We can't wait to meet you both.
          </Text>
        </Section>

        <Section style={card}>
          <Text style={detailLabel}>WHEN</Text>
          <Text style={detailValue}>{eventDateLabel}</Text>
          <Hr style={hr} />
          <Text style={detailLabel}>WHERE</Text>
          <Text style={detailValue}>{location}</Text>
          {sessionSlot && (
            <>
              <Hr style={hr} />
              <Text style={detailLabel}>SESSION</Text>
              <Text style={detailValue}>{sessionSlot}</Text>
            </>
          )}
        </Section>

        <Section style={{ textAlign: 'center', padding: '24px 0' }}>
          <Text style={body}>
            Bring a tennis racket if you have one (we'll have spares!), a water bottle
            and comfy trainers. It's <strong>free</strong> and full of fun.
          </Text>
        </Section>

        <Section style={ctaSection}>
          <Heading style={h2}>Take the next step</Heading>
          <Text style={body}>
            Create a free Parent Hub account to track {childName}'s development, book onto
            future sessions and get updates from our coaches.
          </Text>
          <Button href={`${siteUrl}/auth`} style={button}>
            Set up Parent Hub →
          </Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Suffolk Tennis Partnership · Rising Stars Programme<br />
          Questions? Reply to this email and we'll help.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `You're booked in — ${d?.eventTitle ?? 'Suffolk Rising Stars'} 🎾`,
  displayName: 'Rising Stars sign-up confirmation',
  previewData: {
    parentName: 'Sam',
    childName: 'Alex',
    eventTitle: 'Suffolk Rising Stars Fun Morning',
    eventDateLabel: 'Friday 21st August, 10:00–11:30',
    location: 'Ipswich Sports Club',
    sessionSlot: 'Age 4–5 (born 2020/21)',
    siteUrl: 'https://suffolktennis.online',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const header: React.CSSProperties = { backgroundColor: '#0a1e3c', borderRadius: '12px 12px 0 0', padding: '28px 24px', textAlign: 'center' }
const brand: React.CSSProperties = { color: '#00e5ff', fontSize: '22px', letterSpacing: '2px', margin: 0, fontWeight: 800 }
const tagline: React.CSSProperties = { color: '#f7ff00', fontSize: '14px', letterSpacing: '3px', margin: '4px 0 0', textTransform: 'uppercase' }
const hero: React.CSSProperties = { backgroundColor: '#f7ff00', padding: '28px 24px', textAlign: 'center' }
const h1: React.CSSProperties = { color: '#0a1e3c', fontSize: '28px', fontWeight: 800, margin: 0 }
const lead: React.CSSProperties = { color: '#0a1e3c', fontSize: '16px', lineHeight: '24px', margin: '12px 0 0' }
const card: React.CSSProperties = { backgroundColor: '#f4f7fb', borderRadius: '0 0 12px 12px', padding: '24px' }
const detailLabel: React.CSSProperties = { color: '#0a1e3c', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, margin: 0 }
const detailValue: React.CSSProperties = { color: '#0a1e3c', fontSize: '17px', fontWeight: 600, margin: '2px 0 0' }
const body: React.CSSProperties = { color: '#333', fontSize: '15px', lineHeight: '22px', margin: '0 0 12px' }
const ctaSection: React.CSSProperties = { backgroundColor: '#0a1e3c', borderRadius: '12px', padding: '28px 24px', textAlign: 'center', margin: '20px 0' }
const h2: React.CSSProperties = { color: '#f7ff00', fontSize: '20px', margin: '0 0 8px', fontWeight: 700 }
const button: React.CSSProperties = { backgroundColor: '#00e5ff', color: '#0a1e3c', padding: '12px 28px', borderRadius: '8px', fontWeight: 700, textDecoration: 'none', display: 'inline-block', fontSize: '15px' }
const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #dfe6ee', margin: '16px 0' }
const footer: React.CSSProperties = { color: '#7a8699', fontSize: '12px', textAlign: 'center', lineHeight: '18px', marginTop: '24px' }
