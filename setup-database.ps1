# MediaSite Database Setup Script
# Run this after installing PostgreSQL

Write-Host "🗄️ MediaSite Database Setup" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Check if PostgreSQL is installed
Write-Host "Checking PostgreSQL installation..." -ForegroundColor Yellow
try {
    $psqlVersion = psql --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL is installed!" -ForegroundColor Green
    } else {
        Write-Host "❌ PostgreSQL not found. Please install it first:" -ForegroundColor Red
        Write-Host "   Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Cyan
        Write-Host "   Then run this script again." -ForegroundColor Cyan
        exit 1
    }
} catch {
    Write-Host "❌ PostgreSQL not found. Please install it first:" -ForegroundColor Red
    Write-Host "   Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Cyan
    Write-Host "   Then run this script again." -ForegroundColor Cyan
    exit 1
}

# Update .env.local with your password
Write-Host "`n📝 Please update your .env.local file:" -ForegroundColor Yellow
Write-Host "   1. Replace 'your_password_here' with your PostgreSQL password" -ForegroundColor Cyan
Write-Host "   2. Make sure the database 'mediasite' exists" -ForegroundColor Cyan

# Generate Prisma client
Write-Host "`n🔧 Generating Prisma client..." -ForegroundColor Yellow
npm run db:generate

# Push database schema
Write-Host "`n🗄️ Setting up database schema..." -ForegroundColor Yellow
npm run db:push

Write-Host "`n✅ Database setup complete!" -ForegroundColor Green
Write-Host "🚀 You can now run 'npm run dev' to start the server" -ForegroundColor Cyan 