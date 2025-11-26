import { db } from "./db";
import { categories } from "@shared/schema";

const defaultCategories = [
  { name: "Electronics", slug: "electronics", icon: "Smartphone", description: "Smartphones, laptops, tablets, and accessories" },
  { name: "Fashion", slug: "fashion", icon: "Shirt", description: "Clothes, shoes, bags, and jewelry" },
  { name: "Books & Stationery", slug: "books-stationery", icon: "BookOpen", description: "Textbooks, notebooks, pens, and supplies" },
  { name: "Beauty & Personal Care", slug: "beauty-personal-care", icon: "Sparkles", description: "Makeup, skincare, and personal care products" },
  { name: "Food & Groceries", slug: "food-groceries", icon: "Apple", description: "Pre-packaged foods, snacks, and groceries" },
  { name: "Sports & Fitness", slug: "sports-fitness", icon: "Dumbbell", description: "Sports equipment and fitness gear" },
  { name: "Home & Living", slug: "home-living", icon: "Home", description: "Home decor, kitchenware, and living essentials" },
  { name: "Services", slug: "services", icon: "Briefcase", description: "Tutoring, repairs, and other services" },
  { name: "Tickets & Events", slug: "tickets-events", icon: "Ticket", description: "Event tickets, passes, and reservations" },
  { name: "Furniture", slug: "furniture", icon: "Sofa", description: "Desks, chairs, beds, and dorm essentials" },
  { name: "Gaming", slug: "gaming", icon: "Gamepad2", description: "Consoles, games, and gaming accessories" },
  { name: "Musical Instruments", slug: "musical-instruments", icon: "Music", description: "Instruments, audio equipment, and accessories" },
  { name: "Health & Wellness", slug: "health-wellness", icon: "Heart", description: "Health products and wellness items" },
  { name: "Vehicles", slug: "vehicles", icon: "Bike", description: "Bicycles, motorcycles, and vehicle parts" },
  { name: "Art & Crafts", slug: "art-crafts", icon: "Palette", description: "Art supplies, crafts, and handmade items" },
  { name: "Wigs & Hair", slug: "wigs-hair", icon: "Scissors", description: "Wigs, hair extensions, and hair products" },
  { name: "Perfumes & Fragrances", slug: "perfumes-fragrances", icon: "Flame", description: "Perfumes, body sprays, and fragrances" },
  { name: "Gadgets & Accessories", slug: "gadgets-accessories", icon: "Headphones", description: "Tech gadgets, phone cases, and accessories" },
  { name: "Accounts", slug: "accounts", icon: "User", description: "Social media, gaming, and digital accounts" },
];

async function seed() {
  try {
    console.log("Seeding categories...");
    
    for (const category of defaultCategories) {
      await db.insert(categories)
        .values(category)
        .onConflictDoNothing();
    }
    
    console.log("✓ Categories seeded successfully");
  } catch (error) {
    console.error("Error seeding:", error);
  } finally {
    process.exit(0);
  }
}

seed();
