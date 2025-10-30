import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const text = searchParams.get('text') || 'Image';
        const size = searchParams.get('size') || '600x800';
        const color = searchParams.get('color') || '0e7490';
        const bgColor = searchParams.get('bg') || 'ffffff';
        
        // Parse size
        const [width, height] = size.split('x').map(Number);
        if (!width || !height || width > 2000 || height > 2000) {
            return NextResponse.json({ error: 'Invalid size' }, { status: 400 });
        }
        
        // Generate SVG placeholder
        const svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="diagonal" patternUnits="userSpaceOnUse" width="20" height="20">
                    <path d="M-2,2 l4,-4 M0,20 l20,-20 M18,22 l4,-4" stroke="#${color}" stroke-width="1" opacity="0.3"/>
                </pattern>
                <pattern id="dots" patternUnits="userSpaceOnUse" width="30" height="30">
                    <circle cx="15" cy="15" r="2" fill="#${color}" opacity="0.4"/>
                </pattern>
                <pattern id="grid" patternUnits="userSpaceOnUse" width="40" height="40">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#${color}" stroke-width="1" opacity="0.3"/>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#${color}"/>
            <rect width="100%" height="100%" fill="url(#diagonal)"/>
            <text x="${width/2}" y="${height/2}" text-anchor="middle" fill="#${bgColor}" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 15}" font-weight="bold">${text}</text>
        </svg>`;
        
        // Set proper CORS headers
        const response = new NextResponse(svgContent, {
            status: 200,
            headers: {
                'Content-Type': 'image/svg+xml',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
                'Vary': 'Accept-Encoding'
            }
        });
        
        return response;
        
    } catch (error) {
        console.error('Placeholder generation error:', error);
        return NextResponse.json({ error: 'Failed to generate placeholder' }, { status: 500 });
    }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}


