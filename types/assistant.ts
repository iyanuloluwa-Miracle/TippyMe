export type AssistantTopic = 'payout' | 'earnings' | 'goal' | 'traffic' | 'fees' | 'profile' | 'help';

export interface AssistantReply {
  answer: string;
  displayName: string;
  topic: AssistantTopic;
  checkedAt: string;
  actions: { label: string; to: string }[];
}
