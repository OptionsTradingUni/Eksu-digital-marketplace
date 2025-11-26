import { db } from "./db";
import { categories } from "@shared/schema";

const defaultCategories = [
  { name: "Electronics", slug: "electronics", icon: "Smartphone", description: "Phones, laptops, tablets, and accessories" },
  { name: "Textbooks", slug: "textbooks", icon: "BookOpen", description: "Course materials and study guides" },
  { name: "Fashion", slug: "fashion", icon: "Shirt", description: "Trendy fashion items and accessories" },
  { name: "Clothing & Apparel", slug: "clothing-apparel", icon: "ShirtIcon", description: "Clothes, shoes, and wearables" },
  { name: "Wigs & Hair", slug: "wigs-hair", icon: "Scissors", description: "Wigs, hair extensions, and hair products" },
  { name: "Perfumes & Fragrances", slug: "perfumes-fragrances", icon: "Flame", description: "Perfumes, body sprays, and fragrances" },
  { name: "Beauty & Cosmetics", slug: "beauty-cosmetics", icon: "Sparkles", description: "Makeup, skincare, and beauty products" },
  { name: "Gadgets & Accessories", slug: "gadgets-accessories", icon: "Headphones", description: "Tech gadgets, phone cases, and accessories" },
  { name: "Accounts", slug: "accounts", icon: "User", description: "Social media, gaming, and digital accounts" },
  { name: "Furniture", slug: "furniture", icon: "Sofa", description: "Desks, chairs, beds, and dorm essentials" },
  { name: "Sports", slug: "sports", icon: "Dumbbell", description: "Equipment and athletic wear" },
  { name: "Food & Snacks", slug: "food-snacks", icon: "Apple", description: "Pre-packaged foods, snacks, and treats" },
  { name: "Stationery", slug: "stationery", icon: "Pen", description: "Notebooks, pens, and supplies" },
  { name: "Tickets", slug: "tickets", icon: "Ticket", description: "Event tickets and passes" },
  { name: "Services", slug: "services", icon: "Briefcase", description: "Tutoring, printing, delivery, and more" },
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
