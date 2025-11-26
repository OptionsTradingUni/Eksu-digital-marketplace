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
  { name: "Phones & Tablets", slug: "phones-tablets", icon: "Tablet", description: "Mobile phones, tablets, and related accessories" },
  { name: "Computers & Laptops", slug: "computers-laptops", icon: "Laptop", description: "Laptops, desktops, and computer accessories" },
  { name: "Bags & Luggage", slug: "bags-luggage", icon: "Backpack", description: "Backpacks, handbags, travel bags, and luggage" },
  { name: "Shoes & Footwear", slug: "shoes-footwear", icon: "Footprints", description: "Sneakers, sandals, heels, and all footwear" },
  { name: "Jewelry & Watches", slug: "jewelry-watches", icon: "Watch", description: "Rings, necklaces, bracelets, and watches" },
  { name: "Kitchen & Appliances", slug: "kitchen-appliances", icon: "ChefHat", description: "Cooking appliances, utensils, and kitchenware" },
  { name: "Baby & Kids", slug: "baby-kids", icon: "Baby", description: "Baby products, toys, and children's items" },
  { name: "Pet Supplies", slug: "pet-supplies", icon: "PawPrint", description: "Pet food, accessories, and animal care" },
  { name: "Photography", slug: "photography", icon: "Camera", description: "Cameras, lenses, lighting, and photo equipment" },
  { name: "Drinks & Beverages", slug: "drinks-beverages", icon: "Coffee", description: "Soft drinks, juices, energy drinks, and more" },
  { name: "Clothing Accessories", slug: "clothing-accessories", icon: "Glasses", description: "Belts, hats, scarves, and sunglasses" },
  { name: "Skincare", slug: "skincare", icon: "Droplet", description: "Moisturizers, serums, cleansers, and skincare products" },
  { name: "Haircare", slug: "haircare", icon: "Wind", description: "Shampoos, conditioners, styling products" },
  { name: "Makeup", slug: "makeup", icon: "Brush", description: "Foundation, lipstick, mascara, and cosmetics" },
  { name: "Roommate Needed", slug: "roommate-needed", icon: "Users", description: "Find roommates and shared accommodation" },
  { name: "Lost & Found", slug: "lost-found", icon: "Search", description: "Report or find lost items on campus" },
  { name: "Free Items", slug: "free-items", icon: "Gift", description: "Free giveaways and items to share" },
  { name: "Study Materials", slug: "study-materials", icon: "FileText", description: "Notes, past questions, and study guides" },
  { name: "Rentals", slug: "rentals", icon: "Key", description: "Items available for rent or hire" },
  { name: "Exchange & Swap", slug: "exchange-swap", icon: "ArrowLeftRight", description: "Trade and exchange items with others" },
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
