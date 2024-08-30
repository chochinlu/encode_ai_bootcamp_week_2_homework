import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { languagePrompt, jokeTellerPrompt, generatedJokeTypePrompt } from './prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge' // if you decide to use edge runtime

export async function POST(req: Request) {
  const { messages, imageUrl, temperature, jokeTypes } = await req.json();
  console.log(jokeTypes);

  const jokeTypePrompt = generatedJokeTypePrompt(jokeTypes);
  console.log(jokeTypePrompt);

  // Use the imported prompt
  const systemPrompt = {
    role: 'system',
    content: `${languagePrompt}\n\n${jokeTellerPrompt}\n\n`
  };

  // console.log(systemPrompt);

  let apiMessages = [systemPrompt, ...messages];
  if (apiMessages[apiMessages.length - 1].role === 'user') {
    apiMessages[apiMessages.length - 1].content += `\n\n${jokeTypePrompt}`;
  }

  // If there's an image, add it to the last user message
  if (imageUrl && apiMessages[apiMessages.length - 1].role === 'user') {
    apiMessages[apiMessages.length - 1].content = [
      { type: "text", text: apiMessages[apiMessages.length - 1].content },
      { type: "image_url", image_url: { url: imageUrl } }
    ];
  }

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: apiMessages,
      max_tokens: temperature > 1.3 ? 256 : 512,
      temperature: temperature,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || '';
          controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
