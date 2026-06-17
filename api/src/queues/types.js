/**
 * Canonical job payloads. Document them as JSDoc typedefs so the IDE helps
 * even in pure JS. Producers import these names; workers reference them.
 *
 * Keep payloads small — anything > a few KB belongs in DB / S3 with a pointer.
 *
 * @typedef {object} EmailJob
 * @property {string} to
 * @property {string} subject
 * @property {'welcome'|'password-reset'|'order-receipt'} template
 * @property {Record<string, string|number|boolean>} data  template variables
 * @property {string} [requestId]                          for log correlation
 *
 * @typedef {object} NotificationJob
 * @property {'push'|'sms'|'whatsapp'} channel
 * @property {string} userId
 * @property {string} title
 * @property {string} body
 * @property {Record<string, unknown>} [data]
 *
 * @typedef {object} ReportJob
 * @property {string} tenantId
 * @property {string} branchId
 * @property {'sales-csv'|'monthly-pnl'} type
 * @property {{ from: string, to: string }} range
 * @property {string} requestedBy   userId who asked for it
 *
 * @typedef {object} WebhookJob
 * @property {string} integrationId
 * @property {string} eventType
 * @property {Record<string, unknown>} payload
 * @property {string} [signature]
 *
 * @typedef {object} DlqJob
 * @property {string} originalQueue
 * @property {string} originalJobName
 * @property {string} originalJobId
 * @property {Record<string, unknown>} originalData
 * @property {string} reason
 * @property {string} [stack]
 * @property {number} finalAttempt
 * @property {string} timestamp
 */
export {};
