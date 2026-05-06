#!/bin/bash
# Setup and run the AI backend

set -e

echo "🚀 Setting up Lost & Found AI Backend..."

# Check if Python 3.9+ is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3.9+ is required but not installed."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo "✅ Found Python $PYTHON_VERSION"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📚 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "📝 Please update .env with your OpenAI API key"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the AI service, run:"
echo "  source venv/bin/activate"
echo "  python main.py"
echo ""
echo "Or use:"
echo "  ./run.sh"
