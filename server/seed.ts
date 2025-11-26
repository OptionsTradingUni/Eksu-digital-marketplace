import { db } from "./db";
import { categories } from "@shared/schema";

const defaultCategories = [
  // Core Electronics & Tech
  { name: "Electronics", slug: "electronics", icon: "Smartphone", description: "Smartphones, laptops, tablets, and accessories" },
  { name: "Phones & Tablets", slug: "phones-tablets", icon: "Tablet", description: "Mobile phones, tablets, and related accessories" },
  { name: "Computers & Laptops", slug: "computers-laptops", icon: "Laptop", description: "Laptops, desktops, and computer accessories" },
  { name: "Gadgets & Accessories", slug: "gadgets-accessories", icon: "Headphones", description: "Tech gadgets, phone cases, and accessories" },
  { name: "Gaming", slug: "gaming", icon: "Gamepad2", description: "Consoles, games, and gaming accessories" },
  { name: "Photography", slug: "photography", icon: "Camera", description: "Cameras, lenses, lighting, and photo equipment" },
  
  // Fashion & Style
  { name: "Fashion", slug: "fashion", icon: "Shirt", description: "Clothes, shoes, bags, and jewelry" },
  { name: "Shoes & Footwear", slug: "shoes-footwear", icon: "Footprints", description: "Sneakers, sandals, heels, and all footwear" },
  { name: "Bags & Luggage", slug: "bags-luggage", icon: "Backpack", description: "Backpacks, handbags, travel bags, and luggage" },
  { name: "Jewelry & Watches", slug: "jewelry-watches", icon: "Watch", description: "Rings, necklaces, bracelets, and watches" },
  { name: "Clothing Accessories", slug: "clothing-accessories", icon: "Glasses", description: "Belts, hats, scarves, and sunglasses" },
  { name: "Ankara & Fabrics", slug: "ankara-fabrics", icon: "Scissors", description: "African fabrics, Ankara, lace, and tailoring materials" },
  
  // Beauty & Personal Care
  { name: "Beauty & Personal Care", slug: "beauty-personal-care", icon: "Sparkles", description: "Makeup, skincare, and personal care products" },
  { name: "Skincare", slug: "skincare", icon: "Droplet", description: "Moisturizers, serums, cleansers, and skincare products" },
  { name: "Haircare", slug: "haircare", icon: "Wind", description: "Shampoos, conditioners, styling products" },
  { name: "Makeup", slug: "makeup", icon: "Brush", description: "Foundation, lipstick, mascara, and cosmetics" },
  { name: "Wigs & Hair", slug: "wigs-hair", icon: "Scissors", description: "Wigs, hair extensions, and hair products" },
  { name: "Perfumes & Fragrances", slug: "perfumes-fragrances", icon: "Flame", description: "Perfumes, body sprays, and fragrances" },
  
  // Books & Education
  { name: "Books & Stationery", slug: "books-stationery", icon: "BookOpen", description: "Textbooks, notebooks, pens, and supplies" },
  { name: "Study Materials", slug: "study-materials", icon: "FileText", description: "Notes, past questions, and study guides" },
  { name: "Textbooks", slug: "textbooks", icon: "Book", description: "Course textbooks and academic materials" },
  { name: "Project Materials", slug: "project-materials", icon: "FolderOpen", description: "Materials for school projects and presentations" },
  { name: "Lab Equipment", slug: "lab-equipment", icon: "FlaskConical", description: "Lab coats, safety goggles, and lab supplies" },
  
  // Food & Drinks
  { name: "Food & Groceries", slug: "food-groceries", icon: "Apple", description: "Pre-packaged foods, snacks, and groceries" },
  { name: "Drinks & Beverages", slug: "drinks-beverages", icon: "Coffee", description: "Soft drinks, juices, energy drinks, and more" },
  { name: "Snacks & Provisions", slug: "snacks-provisions", icon: "Cookie", description: "Packaged snacks, biscuits, and student provisions" },
  { name: "Home Cooked Food", slug: "home-cooked-food", icon: "Soup", description: "Homemade meals and food delivery on campus" },
  
  // Home & Living
  { name: "Home & Living", slug: "home-living", icon: "Home", description: "Home decor, kitchenware, and living essentials" },
  { name: "Furniture", slug: "furniture", icon: "Sofa", description: "Desks, chairs, beds, and dorm essentials" },
  { name: "Kitchen & Appliances", slug: "kitchen-appliances", icon: "ChefHat", description: "Cooking appliances, utensils, and kitchenware" },
  { name: "Bedding & Linens", slug: "bedding-linens", icon: "Bed", description: "Mattresses, pillows, bedsheets, and blankets" },
  
  // Nigerian Campus Essentials
  { name: "Data & Airtime", slug: "data-airtime", icon: "Wifi", description: "Data bundles, airtime, and mobile recharge" },
  { name: "Generators & Power", slug: "generators-power", icon: "Zap", description: "Generators, inverters, power banks, and batteries" },
  { name: "Cooking Gas", slug: "cooking-gas", icon: "Flame", description: "Cooking gas refills and gas accessories" },
  { name: "Water & Dispensers", slug: "water-dispensers", icon: "Droplets", description: "Water dispensers, bottles, and purifiers" },
  
  // Services
  { name: "Services", slug: "services", icon: "Briefcase", description: "Tutoring, repairs, and other services" },
  { name: "Tutorial Classes", slug: "tutorial-classes", icon: "GraduationCap", description: "Private tutoring, lessons, and coaching" },
  { name: "Printing & Photocopy", slug: "printing-photocopy", icon: "Printer", description: "Printing, photocopying, and binding services" },
  { name: "Tech Repairs", slug: "tech-repairs", icon: "Wrench", description: "Phone, laptop, and gadget repair services" },
  { name: "Hair & Beauty Services", slug: "hair-beauty-services", icon: "Scissors", description: "Barbing, hair styling, makeup, and nails" },
  { name: "Tailoring & Fashion Design", slug: "tailoring-fashion", icon: "Ruler", description: "Clothing alterations and custom tailoring" },
  { name: "Digital Services", slug: "digital-services", icon: "Monitor", description: "Graphic design, web development, and digital work" },
  { name: "Assignment Help", slug: "assignment-help", icon: "PenTool", description: "Academic writing and project assistance" },
  { name: "Photography Services", slug: "photography-services", icon: "Aperture", description: "Event photography and photo editing" },
  { name: "Laundry Services", slug: "laundry-services", icon: "Shirt", description: "Clothes washing, ironing, and dry cleaning" },
  
  // Entertainment & Events
  { name: "Tickets & Events", slug: "tickets-events", icon: "Ticket", description: "Event tickets, passes, and reservations" },
  { name: "Party Supplies", slug: "party-supplies", icon: "PartyPopper", description: "Decorations, balloons, and party essentials" },
  { name: "Musical Instruments", slug: "musical-instruments", icon: "Music", description: "Instruments, audio equipment, and accessories" },
  
  // Sports & Fitness
  { name: "Sports & Fitness", slug: "sports-fitness", icon: "Dumbbell", description: "Sports equipment and fitness gear" },
  { name: "Gym Equipment", slug: "gym-equipment", icon: "Dumbbell", description: "Home workout and gym equipment" },
  { name: "Sportswear", slug: "sportswear", icon: "Trophy", description: "Athletic clothing, jerseys, and sports shoes" },
  
  // Health & Wellness
  { name: "Health & Wellness", slug: "health-wellness", icon: "Heart", description: "Health products and wellness items" },
  { name: "First Aid & Medicine", slug: "first-aid-medicine", icon: "Stethoscope", description: "First aid kits, OTC medicines, and health supplies" },
  
  // Transportation
  { name: "Vehicles", slug: "vehicles", icon: "Bike", description: "Bicycles, motorcycles, and vehicle parts" },
  { name: "Bicycles", slug: "bicycles", icon: "Bike", description: "Bicycles and cycling accessories" },
  { name: "Motorcycles", slug: "motorcycles", icon: "Bike", description: "Motorcycles, okada, and spare parts" },
  
  // Art & Creativity
  { name: "Art & Crafts", slug: "art-crafts", icon: "Palette", description: "Art supplies, crafts, and handmade items" },
  { name: "Handmade Items", slug: "handmade-items", icon: "Heart", description: "Handcrafted jewelry, decor, and gifts" },
  
  // Digital & Accounts
  { name: "Accounts", slug: "accounts", icon: "User", description: "Social media, gaming, and digital accounts" },
  { name: "Subscriptions", slug: "subscriptions", icon: "CreditCard", description: "Netflix, Spotify, and streaming subscriptions" },
  { name: "Software & Licenses", slug: "software-licenses", icon: "Package", description: "Software, apps, and digital licenses" },
  
  // Other Categories
  { name: "Baby & Kids", slug: "baby-kids", icon: "Baby", description: "Baby products, toys, and children's items" },
  { name: "Pet Supplies", slug: "pet-supplies", icon: "PawPrint", description: "Pet food, accessories, and animal care" },
  { name: "Religious Items", slug: "religious-items", icon: "Church", description: "Prayer mats, rosaries, and religious materials" },
  
  // Campus-Specific
  { name: "Roommate Needed", slug: "roommate-needed", icon: "Users", description: "Find roommates and shared accommodation" },
  { name: "Hostel Items", slug: "hostel-items", icon: "Building", description: "Essential items for hostel living" },
  { name: "Lost & Found", slug: "lost-found", icon: "Search", description: "Report or find lost items on campus" },
  { name: "Free Items", slug: "free-items", icon: "Gift", description: "Free giveaways and items to share" },
  { name: "Rentals", slug: "rentals", icon: "Key", description: "Items available for rent or hire" },
  { name: "Exchange & Swap", slug: "exchange-swap", icon: "ArrowLeftRight", description: "Trade and exchange items with others" },
  { name: "Jobs & Gigs", slug: "jobs-gigs", icon: "Briefcase", description: "Part-time jobs and freelance opportunities" },
  { name: "Internships", slug: "internships", icon: "GraduationCap", description: "Internship and work experience opportunities" },
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
