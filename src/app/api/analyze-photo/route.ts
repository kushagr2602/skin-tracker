import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { imageBase64, mimeType } = await req.json()

  // Retrieve Gemini API key from user metadata
  const apiKey = user.user_metadata?.gemini_api_key as string | undefined
  if (!apiKey) {
    return NextResponse.json(
      { error: 'No Gemini API key set. Please add it in Settings.' },
      { status: 400 }
    )
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `You are a dermatology assistant analyzing a facial skin photo for acne tracking purposes.

Analyze the photo and return a JSON object with these exact fields:
{
  "severity": <integer 1-10 where 1=completely clear, 5=moderate breakout, 10=very severe>,
  "inflammation": <"low" | "medium" | "high">,
  "affected_areas": <array of strings describing areas like "forehead", "chin", "cheeks", "nose", "jawline">,
  "summary": <1-2 sentence plain English description of what you observe>
}

Return ONLY valid JSON, no markdown, no explanation outside the JSON.`

  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data: imageBase64 } },
    ])

    const text = result.response.text().trim()
    // Strip markdown code fences if present
    const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const analysis = JSON.parse(jsonText)

    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('Gemini error:', err)
    return NextResponse.json({ error: 'Failed to analyze photo. Check your API key.' }, { status: 500 })
  }
}
