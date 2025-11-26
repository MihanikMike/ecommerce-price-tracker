# E-Commerce Price Tracker

A Node.js application that monitors and tracks prices of snowboard bindings from Amazon and Burton. The app scrapes product data, stores price history in MongoDB, and exports results to JSON.

## Features

- 🔍 **Multi-site scraping**: Supports Amazon and Burton websites
- 📊 **Price history tracking**: Stores historical price data in MongoDB
- 🎭 **Headless browser automation**: Uses Playwright for reliable web scraping
- 💾 **Data export**: Automatically exports all tracked products to JSON
- 🔄 **Automatic updates**: Tracks price changes over time

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (running locally on port 27017 or remote instance)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/MihanikMike/ecommerce-price-tracker.git
cd ecommerce-price-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers:
```bash
npx playwright install chromium
```

4. Start MongoDB (if running locally):
```bash
# Using Docker
docker run -d -p 27017:27017 mongo

# Or start your local MongoDB service
```

## Configuration

Set the MongoDB connection string (optional):
```bash
export MONGO_URI="mongodb://localhost:27017"
```

Default connection: `mongodb://localhost:27017`

## Usage

Run the price monitor:
```bash
node src/index.js
```

The application will:
1. Connect to MongoDB
2. Scrape product data from configured URLs
3. Save price history to the database
4. Export all products to `products.json`
5. Close database connection

## Project Structure

```
ecommerce-price-tracker/
├── src/
│   ├── index.js                 # Application entry point
│   ├── db/
│   │   ├── connect.js          # MongoDB connection management
│   │   └── models/
│   │       └── Product.js      # Product data model
│   ├── monitor/
│   │   └── price-monitor.js    # Main monitoring logic
│   ├── scraper/
│   │   ├── amazon.js           # Amazon scraper
│   │   └── burton.js           # Burton scraper
│   └── utils/
│       └── fetch-page.js       # Playwright page fetcher
├── package.json
└── readme.md
```

## Adding New Products

Edit `src/monitor/price-monitor.js` and add URLs to the `bindingsUrls` array:

```javascript
const bindingsUrls = [
    "https://www.amazon.com/dp/YOUR_PRODUCT_ID",
    "https://www.burton.com/us/en/p/your-product-url",
];
```

## Database Schema

Products are stored with the following structure:
```javascript
{
  url: "product-url",
  title: "Product Title",
  history: [
    {
      site: "Amazon" or "Burton",
      url: "product-url",
      title: "Product Title",
      price: 279.95,
      timestamp: Date
    }
  ]
}
```

## Troubleshooting

**MongoDB connection error:**
- Ensure MongoDB is running
- Check the connection string in environment variables

**Scraping errors:**
- Website selectors may change; update selectors in scraper files
- Check internet connection
- Some sites may block automated requests

**Playwright errors:**
- Run `npx playwright install chromium` to install browser

## License

ISC

## Author

MihanikMike