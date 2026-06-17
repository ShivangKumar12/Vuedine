/**
 * Conversation serializer — maps to the shape Messages.tsx expects
 * (lowercase channel/status/sender).
 */

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function serializeMessage(m) {
  return {
    id: m.id,
    sender: m.sender.toLowerCase(), // CUSTOMER -> customer
    body: m.body,
    attachments: m.attachments ?? null,
    read: m.read,
    at: m.at?.toISOString?.() ?? m.at,
  };
}

export function serializeConversation(c, { withMessages = false } = {}) {
  const name = c.customerName ?? 'Guest';
  return {
    id: c.id,
    customer: name,
    customerId: c.customerId ?? null,
    phone: c.customerPhone ?? '',
    initials: initials(name),
    channel: c.channel.toLowerCase(), // WHATSAPP -> whatsapp
    channelCode: c.channel,
    status: c.status.toLowerCase(), // OPEN -> open
    statusCode: c.status,
    unread: c.unread,
    lastAt: c.lastAt?.toISOString?.() ?? c.lastAt,
    lastSnippet: c.lastSnippet ?? '',
    tags: c.tags ?? [],
    starred: c.starred,
    agent: c.agentId ?? null,
    agentId: c.agentId ?? null,
    branchId: c.branchId ?? null,
    ...(withMessages ? { messages: (c.messages ?? []).map(serializeMessage) } : {}),
  };
}
