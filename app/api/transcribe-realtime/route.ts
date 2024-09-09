import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  const data = await req.formData();
  const audio = data.get('audio') as File;

  if (!audio) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await audio.arrayBuffer());

    const response = await openai.audio.transcriptions.create({
      file: new File([buffer], audio.name, { type: audio.type }),
      model: "whisper-1",
      language: "tr"
    });

    return NextResponse.json({ transcript: response.text });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}