import { connectDB, closeDB } from "../db/connect-mongo.js";
import { ProductModel } from "../db/models/Product.js";
import { scrapeAmazon } from "../scraper/amazon.js";
import { scrapeBurton } from "../scraper/burton.js";
import fs from "fs"; // for writing JSON file

export async function runPriceMonitor() {
    try {
        const db = await connectDB();
        const Products = ProductModel(db);

    const bindingsUrls = [
        "https://www.amazon.com/dp/B0DHS3B7S1", //snowboard bindings Jones Meteorite
        "https://www.amazon.com/dp/B0DHS5F4PZ",
        "https://www.burton.com/us/en/p/mens-burton-freestyle-reflex-snowboard-bindings/W26-105441B27ORG00M.html" //snowboard bindings Jones Meteorite Surf ser
    ];

    for (const url of bindingsUrls) {
        let data;
        if (url.includes("amazon.com")) {
            data = await scrapeAmazon(url);
        } else if (url.includes("burton.com")) {
            data = await scrapeBurton(url);
        }else{
            continue;
        }

        if (!data) continue;

        await Products.updateOne(
            { url },
            { $push: { history: data }, $set: { title: data.title } },
            { upsert: true }
        );

        console.log("Saved: ", data.title, "$" + data.price);
    }

        // --- Save all products to a JSON file ---
        const allProducts = await Products.find({}).toArray();
        fs.writeFileSync(
            "products.json",
            JSON.stringify(allProducts, null, 2)
        );
        console.log("All products saved to products.json");
    } catch (error) {
        console.error("Error in price monitor:", error);
    } finally {
        await closeDB();
    }
}