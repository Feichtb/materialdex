# SustainSpec

A Revit-plugin-like prototype for sustainable building material recommendations with real product search.

## Overview

SustainSpec helps architects and builders identify sustainable product alternatives for common building materials, complete with links to real products, manufacturer websites, and environmental documentation (EPD, HPD, Declare, VOC certifications).

## Key Features

- **Single Material Scanning**: Scan individual materials one at a time for focused testing and refinement
- **Real Product Links**: Uses web search (via Perplexity) to find actual products with real URLs
- **Documentation Links**: Direct links to EPD, HPD, Declare documents when available
- **Product Recommendations**: Get 3-6 verified sustainable product alternatives per material
- **Documentation Checklist**: Track verification status of sustainability certifications
- **Export Capabilities**: Export to CSV or generate a PDF binder index
- **Local Storage**: All data persists in your browser

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Perplexity API (Sonar Pro with web search)
- OpenAI API (GPT-4.1 fallback)
- jsPDF for PDF generation

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure API keys** - Create a `.env.local` file:
   ```bash
   # Perplexity API Key (recommended - has real-time web search for real products)
   # Get one at https://www.perplexity.ai/settings/api
   PERPLEXITY_API_KEY=pplx-your-api-key-here

   # OpenAI API Key (optional - for GPT-4.1 models without web search)
   # Get one at https://platform.openai.com/api-keys
   OPENAI_API_KEY=sk-your-api-key-here
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Single Material Workflow (Recommended)

1. **Set Project Info**: Enter your project name, ZIP code, and sustainability goals
2. **Add/Edit Materials**: Add materials or use the pre-loaded examples
3. **Scan Individual Material**: Click the "Scan" button next to any material
4. **Review Results**: View real product recommendations with links
5. **Save Products**: Click "Save" on products you want to include
6. **Export**: Generate CSV or PDF documentation

### Bulk Scan (Legacy)

Click "Run Scan" in the header to scan all active materials at once.

## API Endpoints

### POST /api/scan-material

Scans a single material and returns recommendations with real product links.

**Request**:
```json
{
  "material": {"id": "...", "name": "...", "qty": 0, "unit": "sf"},
  "project": {"name": "...", "zip": "97205", "goals": "..."},
  "settings": {"model": "sonar-pro", "conservativeMode": false}
}
```

**Response**:
```json
{
  "id": "...",
  "name": "...",
  "normalized_category": "Thermal Insulation",
  "category_confidence": 0.95,
  "notes_for_user": "...",
  "recommendations": [
    {
      "product_label": "ROCKWOOL COMFORTBOARD 80",
      "manufacturer": "ROCKWOOL",
      "manufacturer_url": "https://www.rockwool.com",
      "product_url": "https://www.rockwool.com/products/comfortboard-80",
      "rationale": "High recycled content, excellent fire resistance...",
      "doc_checklist": {
        "epd": {"status": "verified", "doc_url": "https://..."},
        "hpd": {"status": "verified", "doc_url": "https://..."},
        "declare": {"status": "unverified", "doc_url": null},
        "voc": {"status": "verified", "doc_url": null}
      },
      "confidence": 0.9
    }
  ]
}
```

### POST /api/scan

Bulk scans multiple materials (legacy endpoint).

### POST /api/verify

Verifies a user-provided documentation URL.

## Settings

- **Model Selection**:
  - **Perplexity Sonar Pro** (default): Real-time web search for actual products
  - **Perplexity Sonar**: Faster web search
  - **GPT-4.1**: High quality reasoning, no live web search
  - **GPT-4.1 Mini/Nano**: Faster/cheaper options without web search
  
- **Conservative Mode**: Only return recommendations with high confidence (>70%)
- **Web Search**: Enable/disable real-time product search

## Disclaimer

Recommendations include links found via web search. While we search for real products, always verify links and documentation are current and accurate. Product availability and documentation may change.

## License

MIT
