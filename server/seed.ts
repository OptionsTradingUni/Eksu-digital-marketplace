import { db } from "./db";
import { categories } from "@shared/schema";

const defaultCategories = [
  { name: "Electronics", slug: "electronics", icon: "Smartphone", description: "Phones, laptops, tablets, and accessories" },
  { name: "Textbooks", slug: "textbooks", icon: "BookOpen", description: "Course materials and study guides" },
  { name: "Fashion", slug: "fashion", icon: "Shirt", description: "Clothing, shoes, and accessories" },
  { name: "Furniture", slug: "furniture", icon: "Sofa", description: "Desks, chairs, beds, and dorm essentials" },
  { name: "Sports", slug: "sports", icon: "Dumbbell", description: "Equipment and athletic wear" },
  { name: "Food & Snacks", slug: "food-snacks", icon: "Apple", description: "Pre-packaged foods and treats" },
  { name: "Beauty", slug: "beauty", icon: "Sparkles", description: "Cosmetics and personal care" },
  { name: "Stationery", slug: "stationery", icon: "Pen", description: "Notebooks, pens, and supplies" },
  { name: "Tickets", slug: "tickets", icon: "Ticket", description: "Event tickets and passes" },
  { name: "Services", slug: "services", icon: "Briefcase", description: "Tutoring, printing, and more" },
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
