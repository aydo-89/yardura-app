import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

const ANALYSIS_MODEL = process.env.VET_DOC_ANALYSIS_MODEL ?? 'gpt-4o-mini';

export type VetDocumentAnalysis = {
  patientInfo?: {
    name?: string | null;
    species?: string | null;
    breed?: string | null;
    age?: string | null;
    weight?: string | null;
    sex?: string | null;
  };
  visitInfo?: {
    date?: string | null;
    veterinarian?: string | null;
    clinic?: string | null;
    reason?: string | null;
  };
  diagnostics?: Array<{
    system?: string | null;
    finding: string;
    severity?: string | null;
    notes?: string | null;
  }>;
  problemList?: string[];
  caseSummary?: string | null;
  atHomeCare?: string[];
  followUp?: {
    instructions?: string | null;
    nextAppointment?: string | null;
    watchFor?: string[];
  };
  medications?: Array<{
    name: string;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
    notes?: string | null;
  }>;
  rawFindings?: string | null;
};

const ANALYSIS_PROMPT = `You are an expert veterinary document analyzer. Analyze the following vet document content and extract structured information.

Extract the following if present:
1. Patient Information (name, species, breed, age, weight, sex)
2. Visit Information (date, veterinarian, clinic name, reason for visit)
3. Diagnostics/Findings (organize by body system if applicable: cardiovascular, respiratory, GI, urinary, musculoskeletal, neurological, dermatological, etc.)
4. Problem List (list of diagnosed conditions or concerns)
5. Case Summary (brief summary of the overall findings)
6. At-Home Care Instructions
7. Follow-up (next appointment, what to watch for, when to return)
8. Medications prescribed

Return your analysis as a JSON object with this structure:
{
  "patientInfo": {
    "name": "string or null",
    "species": "string or null",
    "breed": "string or null",
    "age": "string or null",
    "weight": "string or null",
    "sex": "string or null"
  },
  "visitInfo": {
    "date": "string or null",
    "veterinarian": "string or null",
    "clinic": "string or null",
    "reason": "string or null"
  },
  "diagnostics": [
    {
      "system": "string or null (e.g., 'Cardiovascular', 'GI', 'Urinary')",
      "finding": "string describing the finding",
      "severity": "normal/mild/moderate/severe or null",
      "notes": "additional notes or null"
    }
  ],
  "problemList": ["array of diagnosed problems/conditions"],
  "caseSummary": "brief summary string",
  "atHomeCare": ["array of care instructions"],
  "followUp": {
    "instructions": "string or null",
    "nextAppointment": "string or null",
    "watchFor": ["array of warning signs to watch for"]
  },
  "medications": [
    {
      "name": "medication name",
      "dosage": "dosage or null",
      "frequency": "how often or null",
      "duration": "how long or null",
      "notes": "additional notes or null"
    }
  ],
  "rawFindings": "any important information that doesn't fit the above categories"
}

Only include fields that have actual data from the document. Use null for missing values within objects, and empty arrays for missing list data.

Return ONLY the JSON object, no additional text or markdown.`;

export async function analyzeVetDocument(documentId: string, documentUrl: string): Promise<void> {
  const openAiKey = env.OPENAI_API_KEY;
  if (!openAiKey) {
    await prisma.customerVetDocument.update({
      where: { id: documentId },
      data: {
        analysisStatus: 'FAILED',
        analysisError: 'AI service not configured',
      },
    });
    return;
  }

  try {
    // Update status to processing
    await prisma.customerVetDocument.update({
      where: { id: documentId },
      data: { analysisStatus: 'PROCESSING' },
    });

    // Fetch the PDF content
    const response = await fetch(documentUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status}`);
    }

    const pdfBuffer = Buffer.from(await response.arrayBuffer());

    // Extract text from PDF
    let extractedText: string;
    try {
      const parser = new PDFParse({ data: pdfBuffer });
      const textResult = await parser.getText();
      extractedText = textResult.text?.trim() || '';
      await parser.destroy();
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      throw new Error('Failed to extract text from PDF. The document may be scanned or image-based.');
    }

    if (!extractedText || extractedText.length < 10) {
      throw new Error('No readable text found in PDF. The document may be scanned or image-based.');
    }

    // Use OpenAI to analyze the extracted text
    const client = new OpenAI({ apiKey: openAiKey });

    const analysisResponse = await client.responses.create({
      model: ANALYSIS_MODEL,
      input: [
        {
          role: 'system',
          content: 'You are an expert veterinary document analyzer. Analyze veterinary documents and extract structured information accurately.',
        },
        {
          role: 'user',
          content: `${ANALYSIS_PROMPT}\n\n---\nVET DOCUMENT CONTENT:\n${extractedText.slice(0, 15000)}`,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'VetDocumentAnalysis',
          schema: {
            type: 'object',
            properties: {
              patientInfo: {
                type: 'object',
                properties: {
                  name: { type: ['string', 'null'] },
                  species: { type: ['string', 'null'] },
                  breed: { type: ['string', 'null'] },
                  age: { type: ['string', 'null'] },
                  weight: { type: ['string', 'null'] },
                  sex: { type: ['string', 'null'] },
                },
              },
              visitInfo: {
                type: 'object',
                properties: {
                  date: { type: ['string', 'null'] },
                  veterinarian: { type: ['string', 'null'] },
                  clinic: { type: ['string', 'null'] },
                  reason: { type: ['string', 'null'] },
                },
              },
              diagnostics: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    system: { type: ['string', 'null'] },
                    finding: { type: 'string' },
                    severity: { type: ['string', 'null'] },
                    notes: { type: ['string', 'null'] },
                  },
                  required: ['finding'],
                },
              },
              problemList: { type: 'array', items: { type: 'string' } },
              caseSummary: { type: ['string', 'null'] },
              atHomeCare: { type: 'array', items: { type: 'string' } },
              followUp: {
                type: 'object',
                properties: {
                  instructions: { type: ['string', 'null'] },
                  nextAppointment: { type: ['string', 'null'] },
                  watchFor: { type: 'array', items: { type: 'string' } },
                },
              },
              medications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    dosage: { type: ['string', 'null'] },
                    frequency: { type: ['string', 'null'] },
                    duration: { type: ['string', 'null'] },
                    notes: { type: ['string', 'null'] },
                  },
                  required: ['name'],
                },
              },
              rawFindings: { type: ['string', 'null'] },
            },
            additionalProperties: false,
          },
        },
      },
    } as any);

    // Extract the response text
    const outputText = (analysisResponse as any).output_text?.trim();
    if (!outputText) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    let analysis: VetDocumentAnalysis;
    try {
      const firstBrace = outputText.indexOf('{');
      const lastBrace = outputText.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('No JSON found in response');
      }
      analysis = JSON.parse(outputText.slice(firstBrace, lastBrace + 1));
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      analysis = {
        rawFindings: outputText,
      };
    }

    // Update document with analysis
    await prisma.customerVetDocument.update({
      where: { id: documentId },
      data: {
        analysis: analysis as object,
        analysisStatus: 'COMPLETED',
        veterinarian: analysis.visitInfo?.veterinarian || undefined,
        clinic: analysis.visitInfo?.clinic || undefined,
        visitDate: analysis.visitInfo?.date ? new Date(analysis.visitInfo.date) : undefined,
      },
    });
  } catch (error) {
    console.error('Vet document analysis error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    await prisma.customerVetDocument.update({
      where: { id: documentId },
      data: {
        analysisStatus: 'FAILED',
        analysisError: message,
      },
    });
  }
}

// Re-analyze a document (e.g., if initial analysis failed)
export async function reanalyzeVetDocument(documentId: string): Promise<void> {
  const document = await prisma.customerVetDocument.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  // Need to generate a fresh signed URL for re-analysis
  // This would require the storage bucket info which we don't have here
  // For now, just mark as needing re-analysis
  await prisma.customerVetDocument.update({
    where: { id: documentId },
    data: { analysisStatus: 'PENDING' },
  });
}
