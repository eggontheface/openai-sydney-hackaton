import type { OpenAiCoachConversationMessage } from '../ai/openaiCoach';
import type { CoachConversationMessage } from './types';

export function createCoachMessage(
  role: CoachConversationMessage['role'],
  text: string,
): CoachConversationMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
  };
}

export function toOpenAiConversation(
  messages: CoachConversationMessage[],
): OpenAiCoachConversationMessage[] {
  return messages.map((message) => ({
    role: message.role === 'coach' ? 'assistant' : 'user',
    text: message.text,
  }));
}
