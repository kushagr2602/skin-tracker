import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = user.user_metadata?.gemini_api_key as string | undefined
  if (!apiKey) return NextResponse.json({ error: 'No Gemini API key set in Settings.' }, { status: 400 })

  const { imageBase64, mimeType } = await req.json()

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `You are identifying a skincare product, supplement, or medication from a photo of its packaging.

Return ONLY valid JSON with these exact fields:
{
  "name": "<brand + product name, e.g. 'CeraVe Hydrating Cleanser' or 'Vitamin D3 2000IU'>",
  "category": "<one of: cleanser | moisturizer | serum | sunscreen | toner | exfoliant | spot_treatment | supplement | prescription | antibiotic | topical | other>",
  "frequency_suggestion": "<one of: morning | evening | morning_and_evening | once_daily | twice_daily | weekly | as_needed>",
  "dosage": "<dosage if visible, e.g. '1 tablet' or '2 pumps' or null if not applicable>"
}

If you cannot identify the product, return: { "name": null, "category": "other", "frequency_suggestion": "once_daily", "dosage": null }`

  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data: imageBase64 } },
    ])
    const text = result.response.text().trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const product = JSON.parse(text)
    return NextResponse.json({ product })
  } catch (err) {
    console.error('Gemini identify error:', err)
    return NextResponse.json({ error: 'Failed to identify product.' }, { status: 500 })
  }
}
