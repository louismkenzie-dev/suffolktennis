/// <reference types="npm:@types/react@18.3.1" />
import type * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, unknown>
  to?: string
}

import { template as risingStarsConfirmation } from './rising-stars-confirmation.tsx'
import { template as risingStarsAdminNotification } from './rising-stars-admin-notification.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'rising-stars-confirmation': risingStarsConfirmation,
  'rising-stars-admin-notification': risingStarsAdminNotification,
}
