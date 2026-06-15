import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = user.user_metadata?.gemini_api_key as string | undefined
  if (!apiKey) {
    return NextResponse.json({ error: 'No Gemini API key set. Please add it in Settings.' }, { status: 400 })
  }

  const { imageBase64Left, mimeTypeLeft, imageBase64Right, mimeTypeRight } = await req.json()

  if (!imageBase64Left && !imageBase64Right) {
    return NextResponse.json({ error: 'No image provided.' }, { status: 400 })
  }

  const hasBoth = !!(imageBase64Left && imageBase64Right)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `You are a dermatology assistant analyzing ${hasBoth ? 'two facial photos — the left side and right side of the face' : 'a facial photo'} for acne tracking purposes.
${hasBoth ? '\nAnalyze both photos together to give a holistic assessment of the full face.' : ''}
Return a JSON object with these exact fields:
{
  "severity": <integer 1-10 where 1=completely clear, 5=moderate breakout, 10=very severe>,
  "inflammation": <"low" | "medium" | "high">,
  "affected_areas": <array of strings like "forehead", "chin", "left cheek", "right cheek", "nose", "jawline">,
  "summary": <1-2 sentence plain English description${hasBoth ? ', noting differences between sides if relevant' : ''}>
}

Return ONLY valid JSON, no markdown, no explanation outside the JSON.`

  const parts: Array<string | { inlineData: { mimeType: string; data: string } }> = [prompt]
  if (imageBase64Left) parts.push({ inlineData: { mimeType: mimeTypeLeft, data: imageBase64Left } })
  if (imageBase64Right) parts.push({ inlineData: { mimeType: mimeTypeRight, data: imageBase64Right } })

  try {
    const result = await model.generateContent(parts)
    const text = result.response.text().trim()
    const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const analysis = JSON.parse(jsonText)
    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('Gemini error:', err)
    return NextResponse.json({ error: 'Failed to analyze photo. Check your API key.' }, { status: 500 })
  }
}
