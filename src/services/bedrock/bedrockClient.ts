import { signAwsRequest } from './sigv4';

const REGION = process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1';
const ACCESS_KEY_ID = process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || '';
const MODEL_ID = process.env.EXPO_PUBLIC_BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

export class BedrockError extends Error {}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function isBedrockConfigured(): boolean {
  return !!ACCESS_KEY_ID && !!SECRET_ACCESS_KEY;
}

export async function askBedrock(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  if (!isBedrockConfigured()) {
    throw new BedrockError(
      'Amazon Bedrock is not configured. Add your AWS credentials to the .env file and restart the app.'
    );
  }

  const host = `bedrock-runtime.${REGION}.amazonaws.com`;
  const path = `/model/${encodeURIComponent(MODEL_ID)}/invoke`;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const signedHeaders = signAwsRequest({
    method: 'POST',
    host,
    path,
    region: REGION,
    service: 'bedrock',
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
    body,
  });

  let response: Response;
  try {
    response = await fetch(`https://${host}${path}`, {
      method: 'POST',
      headers: signedHeaders,
      body,
    });
  } catch {
    throw new BedrockError('Could not reach Amazon Bedrock. Check your network connection.');
  }

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message = json?.message || `Bedrock request failed (${response.status}).`;
    throw new BedrockError(message);
  }

  const text = json?.content?.[0]?.text;
  if (!text) {
    throw new BedrockError('Bedrock returned an empty response.');
  }
  return text;
}
