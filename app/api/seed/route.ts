import { NextRequest, NextResponse } from 'next/server';
import { seedDatabase } from '@/scripts/seed-database';

export async function POST(request: NextRequest) {
  try {
    // Only allow seeding in development or with a secret key
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (process.env.NODE_ENV === 'production' && secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🌱 Starting database seeding...');
    await seedDatabase();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database seeded successfully' 
    });
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    return NextResponse.json(
      { error: 'Failed to seed database' },
      { status: 500 }
    );
  }
}
